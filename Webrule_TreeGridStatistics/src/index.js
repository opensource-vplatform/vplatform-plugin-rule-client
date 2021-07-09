/**
 * weicd 2012-04-26
 * 树表的逐层统计，在树表的列编辑时触发
 *
 * */
/**
 *	
 */
vds.import("vds.ds.*","vds.tree.*","vds.expression.*","vds.exception.*","vds.math.*","vds.object.*");
/**
 * 规则入口
 */
var main = function (ruleContext) {
    return new Promise(function (resolve, reject) {
        try {
            var inParamsObj = ruleContext.getVplatformInput();
            if (!inParamsObj) { //建议兼容
                inParamsObj = "";
            }
            var tableName = inParamsObj["tableName"];
            var fieldNames = inParamsObj["fieldNames"];
            var treeStruct = inParamsObj["treeStruct"];
            var isSummaryAllNodes = inParamsObj["isSummaryAllNodes"] === "true";
            if (!isSummaryAllNodes) {
                var ruleArgs = ruleContext.getMethodContext().getEventParams();
                if (undefined == ruleArgs[0] || null == ruleArgs[0]) {
                    throw vds.exception.newConfigException("请检查规则【树表数值字段向上汇总】是否配置在树表的数据变化事件中！");
                }
                var operator = ruleArgs[0]["type"];
                var newResult = ruleArgs[0]["newRecord"];
                var oldResult = ruleArgs[0]["oldRecord"];
                if (newResult) {
                    var newIterate = newResult.iterate;
                    while(newIterate.hasNext()){
                        var record = newIterate.next();
                        if (oldResult) {
                            var oldIterart = oldResult.iterate;
                            while(oldIterart.hasNext()){
                                var oRecord = oldIterart.next();
                                if (record.getSysId() == oRecord.getSysId()) {
                                    _newFuntion(oRecord, record, operator, tableName, fieldNames, treeStruct);
                                }
                            }
                        } else {
                            _newFuntion(null, record, operator, tableName, fieldNames, treeStruct);
                        }
                    }
                } else if ("delete" == operator) {


                    oldResult.iterate(function (record) {
                        _newFuntion(record, null, operator, tableName, fieldNames, treeStruct);
                    });

                }
            } else {
                var tree = vds.tree.lookup(tableName, treeStruct[0]);
                var all = tree.getAllRecords();
                var allMap = {};
                var iterator = all.iterator();
                var pidCode = tree.getTreeStruct().getPId();
                while(iterator.hasNext()){
                    var record = iterator.next();
                    var id = record.get("id");
                    var PID = record.get(pidCode);
                    var node = tree.getNodeById(id);
                    if (PID != null && PID != "") {
                        var nodeset = node.getChildren();
                        if (nodeset.size() == 0) {
                            allMap[PID] = node;
                        }
                    }
                }
                // for (var i = 0; i < all.datas.length; i++) {
                //     var id = all.datas[i]["id"];
                //     var PID = all.datas[i]["PID"];
                //     var node = tree.getNodeById(id);
                //     if (PID != null && PID != "") {
                //         if (node.getChildren().datas.length == 0) {
                //             allMap[PID] = node;
                //         }
                //     }
                // }
                for (var prop in allMap) {
                    if (allMap.hasOwnProperty(prop)) {
                        var node = allMap[prop];
                        summary(node, fieldNames, tableName);
                    }
                }
            }
            resolve();
        } catch (err) {
            reject(err);
        }
    });
}
function summary(node, fieldNames, tableName) {
    var parNode = node.getParent();
    if (parNode == null) return;
    var broNodes = parNode.getChildren();
    var zongji = {};
    broNodes.iterate(function (node) {
        var broNode = node.toMap();
        for (var j = 0; j < fieldNames.length; j++) {
            var column = fieldNames[j];
            var isexist = false;
            if (broNode.hasOwnProperty(column)) {
                isexist = true;
            } else {
                column = column.substring(column.indexOf(".") + 1, column.length);
                if (broNode.hasOwnProperty(column)) {
                    isexist = true;
                }
            }
            if (isexist) {
                var b = broNode[column];
                var z = zongji[column]
                if (b == null || b == "") b = 0;
                if (z == null || z == "") z = 0;
                if (zongji[column] != null) {
                    zongji[column] = Number(z) + Number(b);
                } else {
                    zongji[column] = Number(b);
                }

            }
        }
    })
    for (var prop in zongji) {
        if (zongji.hasOwnProperty(prop)) {
            parNode.set(prop, zongji[prop]);
        }
    }
    var datasource = vds.ds.lookup(tableName);
    datasource.updateRecords([parNode]);
    // datasourceUtil.setBaseValue(tableName, [parNode]);
    summary(parNode, fieldNames, tableName);

}

var _newFuntion = function (oldRecord, newRecord, operator, tableName, fieldNames, treeStruct) {
    var record;
    if (!("delete" == operator || "insert" == operator || "update" == operator)) {
        throw vds.exception.newConfigException("[TreeGridStatistics]参数传入错误！请检查配置！");
    }
    if ("delete" == operator) {
        record = oldRecord;
        if (!oldRecord) {
            throw vds.exception.newConfigException("[TreeGridStatistics]系统内部错误，事件没有传入删除的记录。");
        }
    } else if ("insert" == operator) {
        record = newRecord;
        if (!newRecord) {
            throw vds.exception.newConfigException("[TreeGridStatistics]系统内部错误，事件没有传入新增的记录。");
        }
    } else if ("update" == operator) {
        record = newRecord;
        if (!newRecord || !oldRecord) {
            throw vds.exception.newConfigException("[TreeGridStatistics]系统内部错误，事件没有传入更新的记录。");
        }
    }
    var statisticsColumns = fieldNames;
    var dataSource = tableName;
    var changedColumnsValue = _getChangedColumnsValue(statisticsColumns, newRecord ? newRecord.toMap() : null, oldRecord ? oldRecord.toMap() : null);
    var parent = _getParentNode(dataSource, record, treeStruct);
    if (parent == null) {
        return;
    }
    //TODO: 如果一次行更改所有的父亲、父亲的父亲就好了
    for (var i = 0; i < changedColumnsValue.length; i++) {
        var column = _getFieldName(changedColumnsValue[i]["changeColumn"]);
        var value = Number(changedColumnsValue[i]["changeValue"]);
        if (undefined == value || isNaN(value)) {
            continue;
        }
        //父亲节点当前列不为null的情况
        if (!isNaN(parent.get(column))) {
            value = Number(parent.get(column)) + value;
        }
        parent.set(column, value);
    }
    // datasourceUtil.setBaseValue(dataSource, [parent]);
    var datasource = vds.ds.lookup(tableName);
    datasource.updateRecords([parent]);
}

/**
 * 获取值变化的对象
 */
var _getChangedColumnsValue = function (statisticsColumns, newRecord, oldRecord) {
    var changedColumnsValue = [];
    var isContainPrefix = false;
    //记录的属性是否 tablename.fieldName格式，还是fieldname
    if ((newRecord && newRecord.hasOwnProperty(statisticsColumns[0])) || (oldRecord && oldRecord.hasOwnProperty(statisticsColumns[0]))) {
        isContainPrefix = true;
    }
    for (var i = 0; i < statisticsColumns.length; i++) {
        var changeColumn = {};
        var newValue = 0;
        var oldValue = 0;
        var columnName = "";
        if (isContainPrefix) {
            columnName = statisticsColumns[i];
        } else {
            columnName = statisticsColumns[i].substring(statisticsColumns[i].indexOf(".") + 1, statisticsColumns[i].length);
        }
        //如果更新记录中不存在，则代表值无修改
        if (newRecord && !newRecord.hasOwnProperty(columnName)) {
            continue;
        }
        changeColumn["changeColumn"] = columnName;
        if (!(newRecord == null || undefined == newRecord[columnName] || isNaN(newRecord[columnName]))) {
            newValue = Number(newRecord[columnName]);
        }
        if (!(oldRecord == null || undefined == oldRecord[columnName] || isNaN(oldRecord[columnName]))) {
            oldValue = Number(oldRecord[columnName]);
        }
        changeColumn["changeValue"] = vds.math.subtract(newValue, oldValue);
        changedColumnsValue.push(changeColumn);
    }
    return changedColumnsValue;
};

/**
 *  获取父亲节点 
 */
var _getParentNode = function (dataSource, record, treeStruct) {
    var parentNode;

    if (!vds.object.isArray(treeStruct) ||  treeStruct.length != 1) {
        throw vds.exception.newConfigException("参数传入错误，treeStruct接收长度为1的数据");
    }

    if (record) {
        var tree = vds.tree.lookup(dataSource, treeStruct[0]);
        // var node = tree.getNodeById(record.getSysId());
        // parentNode = node.getParent();
        parentNode = tree.getNodeById(record.get(treeStruct[0].pidField));
    }

    return parentNode;
}

var _getFieldName = function (fieldName) {
    if (fieldName != null && fieldName.indexOf(".") > 0) {
        var fieldNames = fieldName.split(".");
        var FNLength = fieldNames.length;
        return fieldNames[FNLength - 1];
    }
    return fieldName;
};

export {
    main
}