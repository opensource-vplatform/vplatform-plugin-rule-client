/**
 * 实体间复制记录, 从实体中复制记录到树形实体（源表实体可以是任意类型，比如说二维表、业务树表等， 目标实体只支持普通的树和树表）
 *
 * @createDate 2013-03-09重构
 */

    var jsonUtil, manager, ExpressionContext, engine, treeManager,factory;

    exports.initModule = function(sb) {
        jsonUtil = sb.getService("vjs.framework.extension.util.JsonUtil");
        manager = sb.getService("vjs.framework.extension.platform.services.model.manager.datasource.DatasourceManager");
        ExpressionContext = sb.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionContext");
        engine = sb.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionEngine");
        treeManager = sb.getService("vjs.framework.extension.platform.services.model.manager.tree.TreeManager");
        factory = sb.getService("vjs.framework.extension.platform.interface.exception.ExceptionFactory");
    }

    // 字段映射关系中的源数据来源类型
    var SOURCE_TYPE = {
        ENTITY: "1", // 实体字段
        SYSTEMVAR: "2", // 系统变量
        COMPONENTVAR: "3", // 组件变量
        EXPRESSION: "4" // 表达式
    };

    var main = function(ruleContext) {
        var inParams = jsonUtil.json2obj(ruleContext.getRuleCfg().inParams);
        // 复制数据来源实体
        var sourceName = inParams.sourceTable;
        // 复制类型：选中行/所有行
        var sourceDataType = inParams.sourceDataType;
        //目标表
        var destTable = inParams.destTable;
        //字段映射关系
        var mappingItems = inParams.mappingItems;
        // 目标表的树形结构
        var treeStruct = inParams.treeStruct;
        // 是否插入到当前节点下面
        var isCurrNode = inParams.isCurrNode;

        var routeContext = ruleContext.getRouteContext();
        var records = null;
        var datasource = manager.lookup({
            "datasourceName": sourceName
        });

        var destDatasource = manager.lookup({
            "datasourceName": destTable
        });
        if (sourceDataType == "all") {
            records = datasource.getAllRecords();
        } else {
            records = datasource.getSelectedRecords();
        }
        if (records)
            records = records.toArray();

        var destTreeStruct = getTreeStructByDataSource(destTable, treeStruct);
        var destTree = treeManager.lookup({
            "datasourceName": destTable,
            "treeStruct": destTreeStruct
        });
        var pidField = destTreeStruct.pidField;
        var curDestRecord = destDatasource.getCurrentRecord(),
            curDestNode = curDestRecord ? destTree.createNodeFromRecord(curDestRecord) : null;
            
        //如果当前节点为空并且是选中了插入当前节点 则提示“目标实体中没有当前节点，请检查目标实体数据是否为空！”
        if(curDestRecord==null&&isCurrNode){
        	HandleException("目标实体中没有当前节点，请检查目标实体数据是否为空！");
        	return null;
        }
        	
        var sourceTreeStruct = getTreeStructByDataSource(sourceName, treeStruct);
        if (sourceTreeStruct != null) {
            var orderNoRefField = sourceTreeStruct.orderField;
            if (orderNoRefField) {
                records.sort(function compare(a, b) {
                    return a.get(orderNoRefField) - b.get(orderNoRefField);
                });
            }
            var sourcePidField = sourceTreeStruct.pidField;
            var roots = [];
            var idMap = {};
            var idChildren = {};
            for (var i = 0; i < records.length; i++) {
                var record = records[i];
                idMap[record.getSysId()] = record;
            }
            for (var id in idMap) {
                var record = idMap[id];
                var parentId = record.get(sourcePidField);
                if (!idMap[parentId]) { //没有找到父节点
                    roots.push(record);
                } else {
                    var children = idChildren[parentId];
                    if (!children) {
                        children = [];
                        idChildren[parentId] = children;
                    }
                    children.push(record);
                }
            }
            var parentNode = null;
            if (isCurrNode) {
                parentNode = [curDestNode];
            }
            insertTree(destTree, parentNode, roots, idChildren, mappingItems,routeContext);
        } else {
            for (var i = 0; i < records.length; i++) {
                var sourceRecord = records[i];
                var defaultValue = _getDefaultValue(sourceRecord, mappingItems,routeContext);
                var node = destTree.createNode();

                for (var j = 0, len = defaultValue.length; j < len; j++) {
                    var tmpTreeValue = defaultValue[j];
                    node.set(tmpTreeValue.fieldName, tmpTreeValue.value, null);
                }
                if (isCurrNode) {
                    curDestNode.addChildren({
                        "children": [node]
                    });
                } else {
                    destTree.insertRoots({
                        "nodes": [node]
                    });
                }

            }
        }
    };

    /**
     * 插入一颗树或树枝， 也可能树枝是不连续的
     */
    var insertTree = function(tree, parentNode, roots, idChildren, mappingItems,routeContext) {
        for (var i = 0; i < roots.length; i++) {
            var root = roots[i];
            insertSubTree(parentNode, root,routeContext);
        }

        /**
         * 插入一颗子树
         */
        function insertSubTree(parentNode, sourceRecord,routeContext) {
            var children = idChildren[sourceRecord.getSysId()];
            var insertRecord;
            var defaultValue = _getDefaultValue(sourceRecord, mappingItems,routeContext);
            var node = tree.createNode();

            for (var i = 0, len = defaultValue.length; i < len; i++) {
                var tmpTreeValue = defaultValue[i];
                node.set(tmpTreeValue.fieldName, tmpTreeValue.value, null);
            }
            if (parentNode && parentNode[0]) {
                parentNode[0].addChildren({
                    "children": [node]
                });
                insertRecord = [node];
            } else {
                insertRecord = tree.insertRoots({
                    "nodes": [node]
                });
            }
            if (children) {
                for (var i = 0; i < children.length; i++) {
                    insertSubTree(insertRecord, children[i],routeContext);
                }
            }
        };

    };

    /**
     * 通过映射关系，获取新增记录的默认值
     * @param mappings 映射信息
     * @param editor 当前树对象
     * @return 结构为json格式：
     * 如：[{"fieldName": tablename.fieldName1, "value":value2}]
     */
    var _getDefaultValue = function(sourceRecord, mappingItems,routeContext) {
        var returnValue = [];
        if (!mappingItems || mappingItems.length <= 0) {
            return returnValue;
        } else {
            for (var i = 0; i < mappingItems.length; i++) {
                var fieldValue = {};
                var destField = mappingItems[i].destField;
                fieldValue["fieldName"] = destField;
                var value = getMappingValue(sourceRecord, mappingItems[i],routeContext);
                fieldValue["value"] = value;
                returnValue.push(fieldValue);
            }
        }
        return returnValue;
    };

    var getMappingValue = function(sourceRecord, mappingItem,routeContext) {
        var sourceField = mappingItem.sourceField;
        var sourceType = mappingItem.operType;
        var value = null;
        switch ("" + sourceType) {
            case "entityField":
                // 来源实体
                value = sourceRecord.get(sourceField);
                break;
            case "expression":
                // 来源表达式
                var context = new ExpressionContext();
                context.setRecords([sourceRecord]);
                context.setRouteContext(routeContext);
                value = engine.execute({
                    "expression": sourceField,
                    "context": context
                });
                break;
            default:
                throw new Error("配置错误！字段映射关系中类型无效：fieldMapping.type=" + sourceType);
        }
        return value;
    }

    /**
     * 是不是树形模型
     * @param dataSource 数据源名称， 如果数据源绑定有树形控件，就当作树形模型
     * @return
     */
    var getTreeStructByDataSource = function(dataSource, treeStruct) {
        var sourceTreeStruct = null;
        for (var i = 0; i < treeStruct.length; i++) {
            if (treeStruct[i]["tableName"] == dataSource) {
                sourceTreeStruct = treeStruct[i];
                break;
            }
        }
        return sourceTreeStruct;
    };
    //异常处理方法 - 弹窗提示
	function HandleException(tmpvar){
		var exception = factory.create({"type":factory.TYPES.Business, "message":tmpvar});
    	exception.handle();
	}
    exports.main = main;

export{    main}