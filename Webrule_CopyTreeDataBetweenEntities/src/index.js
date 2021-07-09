/**
 * 树形结构实体间数据复制, 从实体中复制记录到树形实体（源表实体可以是任意类型，比如说二维表、业务树表等， 目标实体只支持普通的树和树表）
 *
 */

vds.import("vds.ds.*", "vds.exception.*", "vds.expression.*", "vds.tree.*");

var main = function (ruleContext) {
    return new Promise(function (resolve, reject) {
        try {
            //#region 解析规则参数
            var inParams = ruleContext.getVplatformInput();
            //来源实体名称
            var srcName = inParams.sourceTable;
            //复制类型：选中行/所有行
            var sourceDataType = inParams.sourceDataType;
            //目标实体名称
            var destName = inParams.destTable;
            //字段映射关系
            var mappingItems = inParams.mappingItems;
            //树形结构集合
            var treeStruct = inParams.treeStruct;
            //是否插入到当前节点下面
            var isCurrNode = inParams.isCurrNode;
            //#endregion

            //#region 获取目标实体及目标树信息
            var destDatasource = vds.ds.lookup(destName);
            var destCurrentRecord = destDatasource.getCurrentRecord();
            //如果当前节点为空并且是选中了插入当前节点，抛出异常信息
            if (destCurrentRecord == null && isCurrNode) {
                throw vds.exception.newBusinessException("目标实体中没有当前节点，请检查目标实体数据是否为空！");
            }
            var destTreeStruct = getTreeStructByDataSource(destName, treeStruct);
            var destTree = vds.tree.lookup(destName, destTreeStruct);
            var destCurrentNode = destTree.getCurrentNode();
            //#endregion

            //#region 获取来源实体记录
            var srcRecords = null;
            var srcDatasource = vds.ds.lookup(srcName);
            if (sourceDataType == "all") {
                srcRecords = srcDatasource.getAllRecords();
            } else {
                srcRecords = srcDatasource.getSelectedRecords();
            }
            if (srcRecords) {
                srcRecords = srcRecords.toArray();
            }
            //#endregion

            var srcTreeStruct = getTreeStructByDataSource(srcName, treeStruct);
            if (srcTreeStruct != null) {//来源实体为树形结构
                //#region 来源实体记录排序
                var orderNoRefField = srcTreeStruct.orderField;
                if (orderNoRefField) {
                    srcRecords.sort(function compare(a, b) {
                        return a.get(orderNoRefField) - b.get(orderNoRefField);
                    });
                }
                //#endregion

                //#region 来源实体记录生成树形结构
                var srcPidField = srcTreeStruct.pidField;
                var roots = [];
                var idMap = {};
                var idChildren = {};
                for (var i = 0; i < srcRecords.length; i++) {
                    var srcRecord = srcRecords[i];
                    idMap[srcRecord.getSysId()] = srcRecord;
                }
                for (var id in idMap) {
                    var srcRecord = idMap[id];
                    var srcParentId = srcRecord.get(srcPidField);
                    if (!idMap[srcParentId]) { //没有找到父节点
                        roots.push(srcRecord);
                    } else {
                        var children = idChildren[srcParentId];
                        if (!children) {
                            children = [];
                            idChildren[srcParentId] = children;
                        }
                        children.push(srcRecord);
                    }
                }
                //#endregion

                //#region 目标树插入节点
                var parentNode = null;
                if (isCurrNode) {
                    parentNode = [destCurrentNode];
                }
                insertTree(destTree, parentNode, roots, idChildren, mappingItems, ruleContext);
                //#endregion
            } else {
                //#region 目标树插入节点
                for (var i = 0; i < srcRecords.length; i++) {
                    var srcRecord = srcRecords[i];
                    var defaultValue = _getDefaultValue(srcRecord, mappingItems, ruleContext);
                    var node = destTree.createNode();

                    for (var j = 0, len = defaultValue.length; j < len; j++) {
                        var tmpTreeValue = defaultValue[j];
                        node.set(tmpTreeValue.fieldName, tmpTreeValue.value, null);
                    }
                    if (isCurrNode) {
                        destCurrentNode.addChilds([node]);
                    } else {
                        destTree.addRootNodes([node]);
                    }
                }
                //#endregion
            }
            resolve();
        } catch (ex) {
            reject(ex);
        }
    });
};

/**
 * 插入一颗树或树枝， 也可能树枝是不连续的
 */
var insertTree = function (tree, parentNode, roots, idChildren, mappingItems, ruleContext) {
    for (var i = 0; i < roots.length; i++) {
        var root = roots[i];
        insertSubTree(parentNode, root, ruleContext);
    }

    /**
     * 插入一颗子树
     */
    function insertSubTree(parentNode, srcRecord, ruleContext) {
        var children = idChildren[srcRecord.getSysId()];
        var insertRecord;
        var defaultValue = _getDefaultValue(srcRecord, mappingItems, ruleContext);
        var node = tree.createNode();

        for (var i = 0, len = defaultValue.length; i < len; i++) {
            var tmpTreeValue = defaultValue[i];
            node.set(tmpTreeValue.fieldName, tmpTreeValue.value, null);
        }
        if (parentNode && parentNode[0]) {
            parentNode[0].addChilds([node]);
            insertRecord = [node];
        } else {
            insertRecord = tree.addRootNodes([node]);
        }
        if (children) {
            for (var i = 0; i < children.length; i++) {
                insertSubTree(insertRecord, children[i], ruleContext);
            }
        }
    };

};

/**
 * 通过映射关系，获取新增记录的默认值
 * @param srcRecord 来源记录
 * @param mappingItems 字段映射信息
 * @param ruleContext 规则上下文
 * @return 结构为json格式：
 * 如：[{"fieldName": tablename.fieldName1, "value":value2}]
 */
var _getDefaultValue = function (srcRecord, mappingItems, ruleContext) {
    var returnValue = [];
    if (!mappingItems || mappingItems.length <= 0) {
        return returnValue;
    } else {
        for (var i = 0; i < mappingItems.length; i++) {
            var fieldValue = {};
            var destField = mappingItems[i].destField;
            fieldValue["fieldName"] = destField;
            var value = getMappingValue(srcRecord, mappingItems[i], ruleContext);
            fieldValue["value"] = value;
            returnValue.push(fieldValue);
        }
    }
    return returnValue;
};

var getMappingValue = function (srcRecord, mappingItem, ruleContext) {
    var sourceField = mappingItem.sourceField;
    var sourceType = mappingItem.operType;
    var value = null;
    switch ("" + sourceType) {
        case "entityField":
            // 来源实体
            value = srcRecord.get(sourceField);
            break;
        case "expression":
            // 来源表达式
            value = vds.expression.execute(sourceField, { "ruleContext": ruleContext, "records": [srcRecord] });
            break;
        default:
            throw new Error("配置错误！字段映射关系中类型无效：fieldMapping.type=" + sourceType);
    }
    return value;
}

/**
 * 根据数据源名称，获取树形实体结构
 * @param dsName 数据源名称
 * @param treeStruct 树形实体结构集合 
 * @return
 */
var getTreeStructByDataSource = function (dsName, treeStruct) {
    var result = null;
    for (var i = 0; i < treeStruct.length; i++) {
        if (treeStruct[i]["tableName"] == dsName) {
            result = treeStruct[i];
            break;
        }
    }
    return result;
};

exports.main = main;

export { main }