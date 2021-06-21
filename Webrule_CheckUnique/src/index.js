/**
 * 唯一性检查
 */

    var sandBox, jsonUtil, stringUtil, WhereRestrict, Criteria, DatasourceManager, windowVMManager, widgetAction;
    var widgetAction;
    exports.initModule = function(sBox) {
        sandBox = sBox;
        jsonUtil = sBox.getService("vjs.framework.extension.util.JsonUtil");
        stringUtil = sBox.getService("vjs.framework.extension.util.StringUtil");
        ArrayUtil = sBox.getService("vjs.framework.extension.util.ArrayUtil");
        DatasourceManager = sBox.getService("vjs.framework.extension.platform.services.model.manager.datasource.DatasourceManager");
        Criteria = sBox.getService("vjs.framework.extension.platform.interface.model.datasource.Criteria");
        WhereRestrict = sBox.getService("vjs.framework.extension.platform.services.where.restrict.WhereRestrict");
        widgetAction = sBox.getService("vjs.framework.extension.platform.services.view.widget.common.action.WidgetAction");
        widgetContext = sBox.getService("vjs.framework.extension.platform.services.view.widget.common.context.WidgetContext");
        windowVMManager = sBox.getService("vjs.framework.extension.platform.services.vmmapping.manager.WindowVMMappingManager");
    }

    var main = function(ruleContext) {
        var ruleCfgValue = ruleContext.getRuleCfg();
        var inParams = ruleCfgValue["inParams"];
        var ruleConfig = jsonUtil.json2obj(inParams);
        var isBackgroudCheck = ruleConfig.isBackgroudCheck;
        var entityName = ruleConfig.entityName;
        var checkFields = ruleConfig.checkFields;
        var isAutoSelectRepeatRow = ruleConfig.isAutoSelectRepeatRow;
        var repeatRecords = [];

        var routeRuntime = ruleContext.getRouteContext();
        // 前台检查
        //      var isRepeat = _checkEntityUnique(entityName, checkFields, isAutoSelectRepeatRow);
        var isRepeat = _checkEntityUnique_other(entityName, checkFields, isAutoSelectRepeatRow);

        // 后台检查
        // 如果前台已经检查出重复，则不需要再检查后台
        if (isBackgroudCheck == true && isRepeat == false) {
            var tableName = ruleConfig.tableName;
            var dsWhere = ruleConfig.dsWhere;
            isRepeat = _checkTableUnique(entityName, tableName, checkFields, dsWhere, isAutoSelectRepeatRow, routeRuntime);
        }

        if (ruleContext.setBusinessRuleResult) {
            ruleContext.setBusinessRuleResult({
                isUnique: !isRepeat
            });
        }
    }
    var _checkMutilList = function(dataName) {
        var widgetId = windowVMManager.getWidgetCodesByDatasourceName({
            "datasourceName": dataName
        });
        var type = widgetContext.getType(widgetId);
        if ("JGBizCodeTreeGrid" == type || "JGBizCodeTreeView" == type || "JGDataGrid" == type || "JGTreeGrid" == type || "JGTreeView" == type) {
            var displayMode = widgetContext.get(widgetId, "DisplayMode");
            if (displayMode) {

            }
        }
        return false;
    }
    // 检查前台实体是否有重复数据
    var _checkEntityUnique = function(entityName, checkFields, isAutoSelectRepeatRow) {
        var isRepeat = false;
        var recordObjectCache = {};
        var datasource = DatasourceManager.lookup({
            "datasourceName": entityName
        });
        var records = datasource.getAllRecords().toArray();
        var needRecord = [];
        var recordIndex = 0;
        for (var i = 0; i < records.length; i++) {
            var record = records[i];
            var recordValueCache = ""
            for (var j = 0; j < checkFields.length; j++) {
                //              _checkMutilList();
                // 获取并转换字段值，将字段值存入缓存字符串中
                var checkField = checkFields[j].entityFiled;
                checkField = _getFieldCode(checkField);
                var fieldValue = record.get(checkField);

                // 转换字段值，如：code="" 转换为>> code为空
                fieldValue = _convertFieldValue(fieldValue);
                // 如果同时检查多个字段，则把字段值用逗号拼装起来，如：id="123",code="abc"
                recordValueCache = _convertCacheValue(recordValueCache, checkField, fieldValue);
            }
            if (undefined != recordObjectCache[recordValueCache] || null != recordObjectCache[recordValueCache]) {
                // 如果是第一条找到的重复数据，则把重复行设置为当前行
                if (isRepeat == false && isAutoSelectRepeatRow == true) {
                    //                  datasource.setCurrentRecord({
                    //                      record: record
                    //                  });
                    needRecord[recordIndex] = record;
                    recordIndex++;
                }
                isRepeat = true;
                recordObjectCache[recordValueCache].push(record);
            } else {
                recordObjectCache[recordValueCache] = [record];
            }
        }
        var resultParam = {};
        resultParam["records"] = needRecord;
        resultParam["isSelect"] = true;
        datasource.selectRecords(resultParam);
        return isRepeat;
    }

    // 检查前台实体是否有重复数据  2016-08-15 liangzc：更换处理逻辑
    var _checkEntityUnique_other = function(entityName, checkFields, isAutoSelectRepeatRow) {
        var isRepeat = false;
        var recordObjectCache = {};
        var datasource = DatasourceManager.lookup({
            "datasourceName": entityName
        });
        var records = datasource.getAllRecords().toArray();
        var needRecord = [];
        var recordIndex = 0;
        var recordMap = {}; //保存检查字段的数据
        var checkFieldArray = []; //保存所有检查字段
        //将所有检查字段放进Map，所有检查字段对应的一个数组，数组存放该字段的所有数据
        for (var j = 0; j < checkFields.length; j++) {
            var checkField = checkFields[j].entityFiled;
            checkField = _getFieldCode(checkField);
            recordMap[checkField] = [];
            checkFieldArray[j] = checkField;
        }
        var fieldRecord = {}; //第一次出现的记录集合
        var NeedFirstRecord = []; //存放重复的，并且是第一次的记录
        var sureRepeatRecord = [];
        var recordValueCache = "";
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
            var resultParam = {};
            resultParam["records"] = needRecord;
            resultParam["isSelect"] = true;
            datasource.setCurrentRecord({
                record: needRecord[needRecord.length - 1]
            });
            datasource.selectRecords(resultParam);
        }
        return isRepeat;
    }

    // 检查后台表是否有重复数据
    var _checkTableUnique = function(entityName, tableName, checkFields, dsWhere, isAutoSelectRepeatRow, routeRuntime) {
        var isRepeat = false;

        var wrParam = {
            "fetchMode": "table",
            "routeContext": routeRuntime
        };
        // 组装查询条件
        var where = WhereRestrict.init(wrParam);

        var filterCondition = {};
        var datasource = DatasourceManager.lookup({
            "datasourceName": entityName
        });
        var entityRecords = datasource.getAllRecords().toArray();
        if (entityRecords.length === 0)
            return false;

        var fieldType = {};
        var fields = datasource.getMetadata().fields;
        for (var i = 0; i < fields.length; i++) {
            fieldType[fields[i]["code"]] = fields[i]["type"];
        }

        var tmpCondition = {};
        for (var _ii = 0; _ii < checkFields.length; _ii++) {
            var checkField = checkFields[_ii].tableField;
            checkField = _getFieldCode(checkField);
            tmpCondition[checkField] = [];
        }
        for (var i = 0; i < entityRecords.length; i++) {
            var record = entityRecords[i];
            var andEqConds = [];
            for (var t = 0; t < checkFields.length; t++) {
                var checkField = checkFields[t].tableField;
                checkField = _getFieldCode(checkField);
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
        if ("{}" === JSON.stringify(newTmpCondition))
            return false;

        tmpCondition = newTmpCondition;

        var andEqConds = [];
        for (var i = 0; i < checkFields.length; i++) {
            var checkField = _getFieldCode(checkFields[i].tableField);
            var value = tmpCondition[checkField];
            if (value && value.length > 0) {
                value = value.join(",");
                andEqConds = getCondition(checkField, value, fieldType[checkField], "in", andEqConds);
            }
        }
        where.andExtraCondition(andEqConds, "table");
        // 获取前台db变动记录，如果前台记录被删除，则不会再作重复比较
        var entityChangedRecords = [];
        var entityDeletedRecords = [];
        //删除记录
        var deleteRecords = datasource.getDeletedRecords();
        deleteRecords.iterate(function(record, num) {
            entityDeletedRecords.push(record);
        });
        //新增记录
        var insertRecords = datasource.getInsertedRecords();
        insertRecords.iterate(function(record, num) {
            entityChangedRecords.push(record);
        });
        //更新的记录
        var updateRecords = datasource.getUpdatedRecords();
        updateRecords.iterate(function(record, num) {
            entityChangedRecords.push(record);
        });

        var andWhereCons = [];
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
        //      if(tmpNullIn && tmpNullIn.length > 0){
        //          tmpNullIn = tmpNullIn.join(",");
        //          andWhereCons = getCondition("id",tmpNullIn,fieldType["id"],"not in",andWhereCons);
        //          where.andExtraCondition(andWhereCons, "table");
        //      }

        if (undefined != dsWhere && null != dsWhere && dsWhere.length > 0)
            where.andExtraCondition(dsWhere, "table");
        // 查询后台表记录
        var tableRepeatRecords = _getTableRecords(tableName, where);
        tableRepeatRecords = handleOtherCondition(tableRepeatRecords, tmpNullIn, checkFields);
        // 如果有查询到记录，则证明后台查询有重复
        if (undefined != tableRepeatRecords && null != tableRepeatRecords && tableRepeatRecords.length > 0) {
            if (isRepeat == false && isAutoSelectRepeatRow == true) {
                var needRecord = [];
                var recordIndex = 0;
                for (var _a = 0; _a < tableRepeatRecords.length; _a++) {
                    var rec = tableRepeatRecords[_a];
                    if (rec) {
                        var criteria = new Criteria();
                        for (var p in filterCondition) {
                            fieldValue = rec[p];
                            criteria.eq(p, fieldValue)
                        }
                    }

                    var repeateRecords = datasource.queryRecord({
                        "criteria": criteria
                    }).toArray();
                    if (undefined != repeateRecords && null != repeateRecords && repeateRecords.length > 0) {
                        needRecord[recordIndex] = repeateRecords[0];
                        recordIndex++;
                        //                      datasource.setCurrentRecord({
                        //                          record: repeateRecords[0]
                        //                      });
                    }
                }
                var resultParam = {};
                resultParam["records"] = needRecord;
                resultParam["isSelect"] = true;
                datasource.selectRecords(resultParam);
            }
            isRepeat = true;
        }

        return isRepeat;
    }
    /**
     * 处理字段映射条件
     * */
    var handleOtherCondition = function(tableRecord, tmpNullIn, checkFields) {
        var resultRecord = [];
        if (undefined != tableRecord && null != tableRecord && tableRecord.length > 0) {
            for (var i = 0; i < tableRecord.length; i++) {
                var record = tableRecord[i];
                var recordId = tableRecord[i]["id"];
                if (tmpNullIn.indexOf(recordId) == -1) {
                    resultRecord.push(record);
                }
                //              var flag = false;
                //              for(var _i = 0; _i<checkFields.length; _i++){
                //                  var checkField = checkFields[_i].tableField;
                //                  checkField = _getFieldCode(checkField);
                //                  var sourceValue = record[checkField];
                //                  if(!tmpCondition[checkField].contains(sourceValue)){
                //                      flag = true;
                //                      break;
                //                  }
                //              }
                //              if(!flag){
                //                  resultRecord.push(record);
                //              }
            }
        }
        return resultRecord;
    }
    /**
     * 拼装条件
     * */
    var getCondition = function(field, value, fieldType, operation, allCondition) {
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
        //singleCondition["value"] = fieldType == "char" ? "\""+value+"\"":value;
        //不管类型，都加上双引号执行表达式 
        //布尔类型不能加引号 liangzc 20180824
//        singleCondition["value"] = "\"" + value + "\"";
        singleCondition["value"] = fieldType != "boolean" ? "\"" + value + "\"" : value;
        singleCondition["valueType"] = "9";
        allCondition.push(singleCondition);
        return allCondition;
    }
    // 获取后台表数据
    var _getTableRecords = function(tableName, whereRestrict) {
        var records = [];
        var dataQuery = sandBox.getService("vjs.framework.extension.platform.services.repository.query");
        var queryParam = {
            "CheckUnique": true,
            "dataSourceName": tableName,
            "whereRestrict": whereRestrict,
            "queryRecordStart": 0,
            "queryPageSize": -0,
            "queryType": "table"
        };

        // 2015-06-17 liangchaohui：配合SDK的修改作出修改
        dataQuery.query({
            "queryParams": [queryParam],
            "isAsync": false,
            "success": function(resultData) {
                if (ArrayUtil.isArray(resultData) && resultData.length > 0) {
                    var ds = resultData[0];
                    records = ds.datas.values;
                }
            }
        });
        return records;
    }

    // 转换字段中的值
    // 如果值为null或为空串，则作对应转换以便重复判断
    var _convertFieldValue = function(value) {
        if ("null" == value) {
            value = "\"null\"";
        }
        if (value == null || value == "") {
            value = "";
        }
        if (value != null && stringUtil.trim(value + "") == "" && (value + "").length > 0) {
            value = "\"" + value + "\"";
        }
        return "" + value;
    }

    // 转换检查缓存中的值
    // 如果同时检查多个字段，则把多个字段的值都拼装成一个字符串
    var _convertCacheValue = function(cacheValue, checkField, fieldValue) {
        if (cacheValue == "") {
            if (fieldValue == "") {
                cacheValue = checkField + "为空";
            } else {
                cacheValue = checkField + "=" + fieldValue;
            }
        } else {
            if (fieldValue == "") {
                cacheValue = cacheValue + "," + checkField + "为空";
            } else {
                cacheValue = cacheValue + "," + checkField + "=" + fieldValue;
            }
        }
        return cacheValue;
    }

    var _getFieldCode = function(field) {
        //if (field.indexOf(".") >= 0)
            //field = field.split(".")[1];
    	if (field.indexOf(".") >= 0){
    	var fieldSplit = field.split(".");
    	if (fieldSplit.length == 2)    		
    		field = fieldSplit[1];    		
    	else if (fieldSplit.length == 3)
    		field = fieldSplit[2];
    	}
        return field;
    }

    exports.main = main;

export{    main}