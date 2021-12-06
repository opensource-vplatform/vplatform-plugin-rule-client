/**
 * 前后台唯一性检查
 */

vds.import("vds.ds.*", "vds.object.*", "vds.rpc.*", "vds.string.*", "vds.widget.*");

var main = function (ruleContext) {
    return new Promise(function (resolve, reject) {
        try {
            var ruleConfig = ruleContext.getVplatformInput();
            var isBackgroudCheck = ruleConfig.isBackgroudCheck;
            var entityName = ruleConfig.entityName;
            var checkFields = ruleConfig.checkFields;
            var isAutoSelectRepeatRow = ruleConfig.isAutoSelectRepeatRow;
            // 前台检查
            var isRepeat = checkEntityUnique(entityName, checkFields, isAutoSelectRepeatRow);
            // 后台检查
            // 如果前台已经检查出重复，则不需要再检查后台
            if (isBackgroudCheck == true && isRepeat == false) {
                var tableName = ruleConfig.tableName;
                var dsWhere = ruleConfig.dsWhere;
                checkTableUnique(entityName, tableName, checkFields, dsWhere, isAutoSelectRepeatRow, ruleContext, resolve, reject);
            }
            else {
                setResult(ruleContext, isRepeat, resolve);
            }
        } catch (ex) {
            reject(ex);
        }
    });
};

/** 设置规则返回值 */
var setResult = function (ruleContext, isRepeat, resolve) {
    if (ruleContext.setResult) {
        ruleContext.setResult("isUnique", !isRepeat);
    }
    resolve();
}

/** 检查前台实体是否有重复数据 */
var checkEntityUnique = function (entityName, checkFields, isAutoSelectRepeatRow) {
    var isRepeat = false;
    var datasource = vds.ds.lookup(entityName);
    var records = datasource.getAllRecords().toArray();
    var needRecord = [];
    var recordIndex = 0;
    var recordMap = {}; //保存检查字段的数据
    var checkFieldArray = []; //保存所有检查字段
    //将所有检查字段放进Map，所有检查字段对应的一个数组，数组存放该字段的所有数据
    for (var j = 0; j < checkFields.length; j++) {
        var checkField = checkFields[j].entityFiled;
        checkField = getFieldCode(checkField);
        recordMap[checkField] = [];
        checkFieldArray[j] = checkField;
    }
    var fieldRecord = {}; //第一次出现的记录集合
    var NeedFirstRecord = []; //存放重复的，并且是第一次的记录
    var sureRepeatRecord = [];
    var data_record = {};
    for (var i = 0; i < records.length; i++) {
        var record = records[i];
        //保存当前记录的检查字段数据到Map中
        var markField = "";
        for (var j = 0; j < checkFieldArray.length; j++) {
            var isSave = false;
            // 获取并转换字段值，将字段值存入缓存字符串中
            var checkField = checkFieldArray[j];
            var fieldValue = record.get(checkField);
            markField = markField + checkField + "=" + fieldValue + ",";
        }
        if (sureRepeatRecord.indexOf(markField) != -1) { //在确定重复的字段里出现，就代表之前已经有重复过的
            isSave = true;
        } else {
            if (null != data_record[markField]) { //表示该记录不是第一次出现
                isSave = true;
                //第一次记录，还没刷掉时候
                if (fieldRecord[markField] != null) {
                    NeedFirstRecord[NeedFirstRecord.length] = fieldRecord[markField];
                }
                fieldRecord[markField] = null; //刷掉第一次记录
                if (sureRepeatRecord.indexOf(markField) == -1) {
                    sureRepeatRecord[sureRepeatRecord.length] = markField;
                }
            } else {
                data_record[markField] = record; //添加一次记录
                fieldRecord[markField] = record; //标识第一次出现
            }
        }
        if (isSave) {
            needRecord[recordIndex] = record;
            recordIndex++;
            isRepeat = true;
        }
    }
    //添加第一次出现，但重复的记录
    for (var i = 0; i < NeedFirstRecord.length; i++) {
        needRecord[recordIndex] = NeedFirstRecord[i];
        recordIndex++;
    }
    if (isRepeat == true && isAutoSelectRepeatRow == true && needRecord != null && needRecord.length > 0) {
        datasource.setCurrentRecord(needRecord[needRecord.length - 1]);
        datasource.selectRecords(needRecord);
    }
    return isRepeat;
}

/** 检查后台表是否有重复数据 */
var checkTableUnique = function (entityName, tableName, checkFields, dsWhere, isAutoSelectRepeatRow, ruleContext, resolve, reject) {
    var isRepeat = false;
    var wrParam = {
        "type": vds.ds.WhereType.Table,
        "methodContext": ruleContext.getMethodContext()
    };
    // 组装查询条件
    var where = vds.ds.createWhere(wrParam);

    var filterCondition = {};
    var datasource = vds.ds.lookup(entityName);
    var entityRecords = datasource.getAllRecords().toArray();
    if (entityRecords.length === 0) {
        setResult(ruleContext, isRepeat, resolve);
        return false;
    }

    var fieldType = {};
    var fields = datasource.getMetadata().getFields();
    for (var i = 0; i < fields.length; i++) {
        fieldType[fields[i].getCode()] = fields[i].getType();
    }

    var tmpCondition = {};
    for (var _ii = 0; _ii < checkFields.length; _ii++) {
        var checkField = checkFields[_ii].tableField;
        checkField = getFieldCode(checkField);
        tmpCondition[checkField] = [];
    }

    for (var i = 0; i < entityRecords.length; i++) {
        var record = entityRecords[i];
        var andEqConds = [];
        for (var t = 0; t < checkFields.length; t++) {
            var checkField = checkFields[t].tableField;
            checkField = getFieldCode(checkField);
            filterCondition[checkField] = "";
            var fieldValue = record.get(checkField);

            // 移除 null
            if (null === fieldValue)
                continue;

            var single_condition = tmpCondition[checkField];
            single_condition.push(fieldValue);
        }
    }

    var newTmpCondition = {};
    for (var _tmpCond in tmpCondition) {
        var _conditionVal = tmpCondition[_tmpCond];
        if (_conditionVal && _conditionVal.length !== 0)
            newTmpCondition[_tmpCond] = _conditionVal;
    }

    // 检查判断是否前台实体所需检查条件不存在
    if ("{}" === JSON.stringify(newTmpCondition)) {
        setResult(ruleContext, isRepeat, resolve);
        return false;
    }

    tmpCondition = newTmpCondition;

    var andEqConds = [];
    for (var i = 0; i < checkFields.length; i++) {
        var checkField = getFieldCode(checkFields[i].tableField);
        var value = tmpCondition[checkField];
        if (value && value.length > 0) {
            value = value.join(",");
            andEqConds = getCondition(checkField, value, fieldType[checkField], "in", andEqConds);
        }
    }

    where.addCondition(andEqConds);

    // 获取前台db变动记录，如果前台记录被删除，则不会再作重复比较
    var entityChangedRecords = [];
    var entityDeletedRecords = [];
    //删除记录
    var deleteRecords = datasource.getDeletedRecords();
    deleteRecords.iterate(function (record, num) {
        entityDeletedRecords.push(record);
    });
    //新增记录
    var insertRecords = datasource.getInsertedRecords();
    insertRecords.iterate(function (record, num) {
        entityChangedRecords.push(record);
    });
    //更新的记录
    var updateRecords = datasource.getUpdatedRecords();
    updateRecords.iterate(function (record, num) {
        entityChangedRecords.push(record);
    });

    var tmpNullIn = [];
    for (var i = 0; i < entityDeletedRecords.length; i++) {
        var deleteRecord = entityDeletedRecords[i];
        var idValue = deleteRecord.getSysId();
        if (tmpNullIn.indexOf(idValue) == -1) {
            tmpNullIn.push(idValue);
        }
    }
    for (var i = 0; i < entityRecords.length; i++) {
        var record = entityRecords[i];
        var idValue = record.getSysId();
        if (tmpNullIn.indexOf(idValue) == -1) {
            tmpNullIn.push(idValue);
        }
    }

    if (undefined != dsWhere && null != dsWhere && dsWhere.length > 0)
        where.addCondition(dsWhere);

    //检测后台表记录
    getTableRecords(tableName, where, tmpNullIn, isAutoSelectRepeatRow, filterCondition, datasource, ruleContext, resolve, reject);
}

/** 拼装条件 */
var getCondition = function (field, value, fieldType, operation, allCondition) {
    var logicOperation = null;
    if (allCondition.length > 0) {
        logicOperation = "and"
    }
    var singleCondition = {};
    singleCondition["columnType"] = "1";
    singleCondition["field"] = field;
    singleCondition["fieldType"] = fieldType;
    singleCondition["leftBracket"] = "(";
    singleCondition["logicOperation"] = logicOperation;
    singleCondition["operation"] = operation;
    singleCondition["rightBracket"] = ")";
    singleCondition["value"] = fieldType != "boolean" ? "\"" + value + "\"" : value;
    singleCondition["valueType"] = "9";
    allCondition.push(singleCondition);
    return allCondition;
}

/** 检测后台表数据 */
var getTableRecords = function (tableName, whereRestrict, tmpNullIn, isAutoSelectRepeatRow, filterCondition, datasource, ruleContext, resolve, reject) {
    var callback = function (resultData) {
        var isRepeat = false;
        if (vds.object.isArray(resultData) && resultData.length > 0) {
            var ds = resultData[0];
            var records = ds.datas.values;
            var tableRepeatRecords = handleOtherCondition(records, tmpNullIn);
            // 如果有查询到记录，则证明后台查询有重复
            if (undefined != tableRepeatRecords && null != tableRepeatRecords && tableRepeatRecords.length > 0) {
                if (isAutoSelectRepeatRow == true) {
                    var needRecord = [];
                    var recordIndex = 0;
                    for (var _a = 0; _a < tableRepeatRecords.length; _a++) {
                        var rec = tableRepeatRecords[_a];
                        if (rec) {
                            var criteria = vds.ds.createCriteria();
                            for (var p in filterCondition) {
                                var fieldValue = rec[p];
                                criteria.eq(p, fieldValue)
                            }
                        }

                        var repeateRecords = datasource.queryRecord(criteria).toArray();
                        if (undefined != repeateRecords && null != repeateRecords && repeateRecords.length > 0) {
                            needRecord[recordIndex] = repeateRecords[0];
                            recordIndex++;
                        }
                    }
                    datasource.selectRecords(needRecord);
                }
                isRepeat = true;
                setResult(ruleContext, isRepeat, resolve);
            }
            else {
                setResult(ruleContext, isRepeat, resolve);
            }
        }
        else {
            setResult(ruleContext, isRepeat, resolve);
        }
    }

    vds.rpc.queryDataSync(tableName, "table", null, null, {
        "where": whereRestrict,
        "pageConfig": {
            "pageSize": -0,
            "recordStart": 0,
        },
        "methodContext": ruleContext.getMethodContext(),
        "CheckUnique": true,
        "success": callback,
        "fail": reject
    });
}

/** 处理字段映射条件 */
var handleOtherCondition = function (tableRecord, tmpNullIn) {
    var resultRecord = [];
    if (undefined != tableRecord && null != tableRecord && tableRecord.length > 0) {
        for (var i = 0; i < tableRecord.length; i++) {
            var record = tableRecord[i];
            var recordId = tableRecord[i]["id"];
            if (tmpNullIn.indexOf(recordId) == -1) {
                resultRecord.push(record);
            }
        }
    }
    return resultRecord;
}

/** 获取字段编码 */
var getFieldCode = function (field) {
    if (field.indexOf(".") >= 0) {
        var fieldSplit = field.split(".");
        if (fieldSplit.length == 2)
            field = fieldSplit[1];
        else if (fieldSplit.length == 3)
            field = fieldSplit[2];
    }
    return field;
}

export { main }