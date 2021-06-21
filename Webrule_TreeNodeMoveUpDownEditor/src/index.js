/**
 *  weicd 2011-11-30
 *  树形操作：
 *    1. 下级新增；
 *    2. 同级新增；
 *    3. 删除；
 *    4. 上移；下移；
 *    5. 升级； 降级；
 *
 */

    var jsonUtil;
    var formulaUtil;
    var objectUtil;
    var sandbox;
    var manager;
    var componentParam;
    var windowParam;
    var errorUtil;
    var dialogUtil;
    var util;
    var ExpressionContext;
    var engine;

    exports.initModule = function(sb) {
        sandbox = sb;
        jsonUtil = sb.getService("vjs.framework.extension.util.JsonUtil");
        objectUtil = sb.util.object;
        manager = sb.getService("vjs.framework.extension.platform.services.model.manager.datasource.DatasourceManager");
        componentParam = sb.getService("vjs.framework.extension.platform.data.storage.runtime.param.ComponentParam");
        windowParam = sb.getService("vjs.framework.extension.platform.services.param.manager.WindowParam");
        errorUtil = sb.getService("vjs.framework.extension.platform.services.view.widget.common.error.ErrorUtil");
        dialogUtil = sb.getService("vjs.framework.extension.platform.services.view.widget.common.dialog.DialogUtil");
        util = sb.getService("vjs.framework.extension.util.ArrayUtil");
        ExpressionContext = sb.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionContext");
        engine = sb.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionEngine");
    }

    var _respCallBack = function(result) {
        if (result.success == false) {
            errorUtil.handleError("保存失败！" + result.msg);
        }
    };

    /**
     * 给数据源插入记录的对象
     * @param {String} datasourceName 数据源名称
     * @param {Object} treeStruct 树形结构
     */
    function TreeNodeEditor(datasourceName, treeStruct) {
        if (!util.isArray(treeStruct) || (util.isArray(treeStruct) && treeStruct.length != 1)) {
            throw new Error("参数传入错误，treeStruct接收长度为1的数据");
        }
        var treeManager = sandbox.getService("vjs.framework.extension.platform.services.model.manager.tree.TreeManager");
        this.tree = treeManager.lookup({
            "datasourceName": datasourceName,
            "treeStruct": treeStruct[0]
        });
        this.datasourceName = datasourceName;
        this.isSupportMultiRoots = true;
    };

    /**
     * 插入根节点的方法
     * @param defaultValue 插入记录的默认值，结构为json格式：
     * 如：[{"fieldName": tablename.fieldName1, "value":value2}]
     */
    TreeNodeEditor.prototype.insertRootNode = function(defaultValue) {
        if (!this.isSupportMultiRoots) {
            var roots = this.tree.getRoots();
            if (roots && roots.length > 0) {
                dialogUtil.propmtDialog("暂不支持多个根节点的树形结构", null, false);
                return false;
            }
        }
        var node = this.tree.createNode();
        this.fillField(node, defaultValue);
        var params = {
            "nodes": [node]
        };
        this.tree.insertRoots(params);
        return true;
    };

    /**
     * 填充树节点字段值
     */
    TreeNodeEditor.prototype.fillField = function(node, values) {
        if (values && values.length > 0) {
            sandbox.util.collections.each(values, function(value) {
                node.set(value.fieldName, value.value);
            });
        }
    }

    /**
     * 插入孩子节点的方法
     * @param defaultValue 插入记录的默认值，结构为json格式：
     * 如：[{"fieldName": value}]
     *
     */
    TreeNodeEditor.prototype.insertSunNode = function(defaultValue) {
        var roots = this.tree.getRoots();
        if (roots.isEmpty()) {
            return this.insertRootNode(defaultValue);
        }
        var record = this.tree.getCurrentRecord();
        if (!record) {
            dialogUtil.propmtDialog("请选择你要操作的节点!", null, false);
            return false;
        }
        var primaryVal = record.getSysId();
        var parent = this.tree.getNodeById(primaryVal);
        var node = this.tree.createNode();
        this.fillField(node, defaultValue);
        parent.addChildren({
            "children": [node]
        });
    };

    /**
     * 插入兄弟节点的方法
     * @param defaultValue 插入记录的默认值，结构为json格式：
     * 如：[{"fieldName": tablename.fieldName1, "value":value2}]
     * @param position 插入节点的位置，相对于选中的节点
     */
    TreeNodeEditor.prototype.insertBrotherNode = function(defaultValue, position) {
        var roots = this.tree.getRoots();
        if (roots.isEmpty()) {
            return this.insertRootNode(defaultValue);
        }
        var currNode = this._getCurrentNode();
        if (!currNode) return false;
        if (!this.isSupportMultiRoots) { // 不支持多个根节点
            var isSelectRoot = false;
            var iterator = roots.iterator();
            while (iterator.hasNext()) {
                var root = iterator.next();
                if (root.getSysId() == currNode.getSysId()) {
                    isSelectRoot = true;
                    break;
                }
            }
            if (isSelectRoot) {
                dialogUtil.propmtDialog("不支持多个根节点的树形结构!", null, false);
                return false;
            }
        }
        var toNode;
        var move_position = currNode.Enum.ABOVE;
        switch (position) {
            case "First":
                //增加到兄弟节点的老大
                //var nodes = this.getChildren(selectedNode.get(this.parentIdRefField));
                //toNode = nodes[0];
                break;
            case "Last":
                //增加到兄弟节点的老小, 系统算法自动添加到最后
                break;
            case "Before":
                //增加到兄弟节点的最小哥哥
                break;
            case "After":
                //增加到兄弟节点的最大的弟弟
                move_position = currNode.Enum.BELLOW;
                break;
            default:
                //rendererUtil.errorDialog("传入参数错误，请检查！", false);
                errorUtil.handleError("传入参数错误，请检查！");
                break;
        }
        var node = this.tree.createNode();
        this.fillField(node, defaultValue);
        currNode.addBrothers({
            "brothers": [node],
            "operation": move_position
        });
    };

    /**
     * 上移节点
     *
     */
    TreeNodeEditor.prototype.moveupTreeNode = function() {
        var currNode = this._getCurrentNode();
        if (currNode) {
            var result = currNode.move({
                "operation": currNode.Enum.ABOVE
            });
            if (!result) {
                dialogUtil.propmtDialog("已经是最上节点不能再向上移动!", null, false);
                return false;
            }
        }
    };

    /**
     * 下移节点
     *
     */
    TreeNodeEditor.prototype.movedownTreeNode = function() {
        var currNode = this._getCurrentNode();
        if (currNode) {
            var result = currNode.move({
                "operation": currNode.Enum.BELLOW
            });
            if (!result) {
                dialogUtil.propmtDialog("已经是最下节点不能再向下移动!", null, false);
                return false;
            }
        }
    };

    TreeNodeEditor.prototype._getCurrentNode = function() {
        var currRecord = this.tree.getCurrentRecord();
        if (!currRecord) {
            dialogUtil.propmtDialog("请选择你要操作的节点!", null, false);
            return null;
        }
        var primaryVal = currRecord.getSysId();
        return this.tree.getNodeById(primaryVal);
    }

    /**
     * 升级节点
     *
     */
    TreeNodeEditor.prototype.upgradeTreeNode = function() {
        var currNode = this._getCurrentNode();
        if (currNode) {
            if (currNode.isRoot()) {
                dialogUtil.propmtDialog("根节点不允许升级!", null, false);
                return false;
            }
            currNode.move({
                "operation": currNode.Enum.UPGRADE
            });
        }
    };

    //降级节点
    TreeNodeEditor.prototype.downgradeTreeNode = function() {
        var currNode = this._getCurrentNode();
        if (currNode) {
            var brother = currNode.getOlderBrothers();
            if (brother.isEmpty()) {
                dialogUtil.propmtDialog("上面无同级节点，不能降级!", null, false);
                return false;
            }
            currNode.move({
                "operation": currNode.Enum.DOWNGRADE
            });
        }
    };

    //移除树节点 add by xiedh 2014-12-26
    TreeNodeEditor.prototype.removeTreeNode = function() {
        var resultSet = this.tree.getSelectedRecords();
        var removeIds = [];
        if (resultSet.isEmpty()) {
        	//多选模式下不能够获取当前行作为删除的记录
        	if(!this.tree.isMultipleSelect()){
        		var record = this.tree.getCurrentRecord();
                if(record)
                    removeIds.push(record.getSysId());
        	}
        } else {
            var iterator = resultSet.iterator();
            while (iterator.hasNext()) {
                var node = iterator.next();
                removeIds.push(node.getSysId());
            }
        }
        this.tree.removeNodeByIds({
            "ids": removeIds
        });
    }

    /**
     * 通过映射关系，获取新增记录的默认值
     * @param mappings 映射信息
     * @param editor 当前树对象
     * @return 结构为json格式：
     * 如：[{"fieldName": tablename.fieldName1, "value":value2}]
     */
    var _getDefaultValue = function(mappings, editor, routeContext) {
        var returnValue = [];
        var filterColumns = ["InnerCode", "NodeLevel"];
        //TODO: 把所有的过滤列都通过获取的方式
        filterColumns.push(editor.parentIdRefField);
        filterColumns.push(editor.orderNoRefField);
        filterColumns.push(editor.isLeafRefField);

        if (!mappings || mappings.length <= 0) {
            return returnValue;
        } else {
            for (var i = 0; i < mappings.length; i++) {
                var fieldValue = {};
                var destColumn = getFieldName(mappings[i]["destColumn"]);
                var isFilter = false;
                for (var column in filterColumns) {
                    if (destColumn == filterColumns[column]) {
                        isFilter = true;
                        break;
                    }
                }
                if (isFilter)
                    continue;
                fieldValue["fieldName"] = destColumn;
                var srcField = mappings[i]["fieldValue"];
                var fieldType = mappings[i]["type"];
                if (fieldType === '1') {
                    var dataSourceName = srcField.substring(0, srcField.indexOf("."));
                    var datasource = manager.lookup({
                        "datasourceName": dataSourceName
                    });
                    var selected = datasource.getCurrentRecord();
                    if (selected) {
                        srcField = getFieldName(srcField);
                        fieldValue["value"] = selected.get(srcField);
                    }
                } else if (fieldType === '2') {
                    //如果是系统变量
                    fieldValue["value"] = componentParam.getVariant({
                        "code": srcField
                    });
                } else if (fieldType === '3') {
                    //如果是组件变量
                    fieldValue["value"] = windowParam.getInput({
                        "code": srcField
                    });
                } else if (fieldType === '4' || fieldType === "expression") {
                    //如果是表达式
                    var context = new ExpressionContext();
                    context.setRouteContext(routeContext);
                    fieldValue["value"] = engine.execute({
                        "expression": srcField,
                        "context": context
                    });
                }
                returnValue.push(fieldValue);
            }
        }
        return returnValue;
    };

    var getFieldName = function(fieldName) {
        var retvalue = fieldName;
        if (fieldName.indexOf(".") != -1) {
            var fieldNames = fieldName.split(".");
            retvalue = fieldName.split(".")[fieldNames.length - 1];
        }
        return retvalue;
    };

    var main = function(ruleContext) {
        var ruleCfgValue = ruleContext.getRuleCfg();
        var inParams = ruleCfgValue["inParams"];
        var inParamsObj = jsonUtil.json2obj(inParams);
        var dataSourceName = inParamsObj["dataSourceName"];
        var treeStruct = inParamsObj["treeStruct"];
        var operation = inParamsObj["controlType"];
        var mappings = inParamsObj["mapping"];
        var editor = new TreeNodeEditor(dataSourceName, treeStruct);
        var defaultValue = _getDefaultValue(mappings, editor, ruleContext.getRouteContext());
        switch (operation) {
            case "1":
                //增加到兄弟节点的老大
                editor.insertBrotherNode(defaultValue, "First");
                break;
            case "2":
                //增加到兄弟节点的老小
                editor.insertBrotherNode(defaultValue, "Last");
                break;
            case "3":
                //增加到兄弟节点的最小哥哥
                editor.insertBrotherNode(defaultValue, "Before");
                break;
            case "4":
                //增加到兄弟节点的最大的弟弟
                editor.insertBrotherNode(defaultValue, "After");
                break;
            case "5":
                //增加孩子节点，默认最小的孩子
                editor.insertSunNode(defaultValue);
                break;
            case "6":
                editor.moveupTreeNode();
                break;
            case "7":
                editor.movedownTreeNode();
                break;
            case "8":
                editor.upgradeTreeNode();
                break;
            case "9":
                editor.downgradeTreeNode();
                break;
            case "10":
                //插入根节点
                editor.insertRootNode(defaultValue);
                break;
            case "11":
                //删除树节点 add by xiedh 2014-12-26
                editor.removeTreeNode();
                break;
            default:
                break;
        }
    };

    exports.main = main;
    exports._getDefaultValue = _getDefaultValue;
    exports.TreeNodeEditor = TreeNodeEditor;


export{    main}