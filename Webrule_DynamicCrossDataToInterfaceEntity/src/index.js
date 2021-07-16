/**
 * 加载动态交叉表到实体
 */

var paginationService;
var dataAdapter;
var DataAccessObject;

exports.initModule = function (sBox) {
    paginationService = sBox.getService("vjs.framework.extension.platform.services.widget.pagination.facade");
    dataAdapter = sBox.getService("vjs.framework.extension.platform.services.viewmodel.dataadapter.DataAdapter");
    DataAccessObject = sBox.getService("vjs.framework.extension.platform.services.repository.data.object");
};

vds.import("vds.ds.*", "vds.exception.*", "vds.expression.*", "vds.string.*");

//规则主入口(必须有)
var main = function (ruleContext) {
    return new Promise(function (resolve, reject) {
        try {
            //获取规则上下文中的规则配置值
            var inParamsObj = ruleContext.getVplatformInput();
            var isAsyn = inParamsObj["isAsyn"];
            var routeRuntime = ruleContext.getRouteContext();
            var callBack = routeRuntime.getCallBackFunc();
            var callBackFunc = function (output) {
                if (typeof (callBack) == "function") {
                    callBack.apply(routeRuntime, [routeRuntime]);
                }
            }
            var itemConfigs = inParamsObj["itemsConfig"];
            for (var i = 0; i < itemConfigs.length; i++) {
                var itemConfig = itemConfigs[i];
                var isType = itemConfig["Istype"];
                //查询：1，表：0
                var queryConds = itemConfig["dsWhere"];
                // 过滤条件
                var entityName = itemConfig["entityName"];
                //目标DB
                var itemqueryparam = itemConfig["itemqueryparam"];
                //源数据中的字段
                var items = itemConfig["items"];
                //高级查询参数值
                var tableOrQuery = itemConfig["tableOrQuery"];
                var valueFunctions = itemConfig["valueFunctions"];
                //这里要处理常量和表达式的交互
                if (tableOrQuery != null && tableOrQuery.length > 0) {
                    for (var index = 0; index < tableOrQuery.length; index++) {
                        var columntableOrQuery = tableOrQuery[index];

                        var columnName = columntableOrQuery["paramsName"];
                        var columnValue = columntableOrQuery["paramsValue"];
                        if (columnName == "rowSumName" || columnName == "colSumName") {
                            if (!isEmpty(columnValue)) {
                                columnValue = vds.expression.execute(columnValue, { "ruleContext": ruleContext });
                                columntableOrQuery["paramsValue"] = columnValue;
                            }
                        }
                        if (columnName == 'isEmptyToProduceDynamicCol') {
                            if (!isEmpty(columnValue)) {
                                columntableOrQuery["paramsValue"] = vds.expression.execute(columnValue, { "ruleContext": ruleContext });
                            }
                        }
                    }
                    if (valueFunctions != null) {
                        var entityObject = vds.string.toJson(valueFunctions, false);
                        var values = { "paramsName": "valueFunctions", "paramsValue": entityObject };
                        tableOrQuery.push(values);
                    }
                }

                //映射关系
                var sourceName = itemConfig["sourceName"];
                //源数据Name
                //处理非数据集字段的映射值
                var mappings = getMappings(items, ruleContext);
                // 根据过滤条件获取出源数据源数据
                var isCustomSqlFind = (isType + "") == "1";
                var wrParam = {
                    "type": isCustomSqlFind ? vds.ds.WhereType.Query : vds.ds.WhereType.Table,
                    "methodContext": ruleContext.getMethodContext()
                };
                var whereRestrict = vds.ds.createWhere(wrParam);
                if (undefined != queryConds && null != queryConds && queryConds.length > 0) {
                    whereRestrict.addCondition(queryConds);
                }

                params = genCustomParams(itemqueryparam, ruleContext);
                whereRestrict.addParameters(params);

                var routeRuntime = ruleContext.getRouteContext();
                var paginationObj = paginationService.getPagingInfoByDataSource(entityName);
                var recordStart = paginationObj.recordStart;
                var pageSize = paginationObj.pageSize;

                var isAsyn = isAsyn;
                var callBack = callBackFunc;

                var queryParams = {};
                var queryType = "Table";
                if (isType == 1) { //自定义查询
                    queryType = "Query";
                    queryParams = genCustomSqlQueryParams(whereRestrict.toParameters());
                    if (i < itemConfigs.length - 1) {
                        isAsyn = false;
                        callBack = null;
                    } else {
                        isAsyn = isAsyn;
                        callBack = callBackFunc;
                    }
                } else {
                    queryParams = whereRestrict.toParameters();
                    // 排序条件处理
                    var orderByCfg = itemConfig["orderBy"];
                    if (orderByCfg && typeof orderByCfg != 'undefined' && orderByCfg.length > 0) {
                        for (var obIndex = 0; obIndex < orderByCfg.length; obIndex++) {
                            var orderByItem = orderByCfg[obIndex];
                            if (!orderByItem.field || orderByItem.field == "") {
                                continue;
                            }
                            var fieldArray = orderByItem.field.split(".");
                            var orderByField = fieldArray[fieldArray.length - 1];
                            if (orderByItem.type.toLowerCase() == 'desc') {
                                whereRestrict.addOrderByDesc(orderByField);
                            } else {
                                whereRestrict.addOrderBy(orderByField);
                            }
                        }
                    }
                    if (i < itemConfigs.length - 1) {
                        isAsyn = false;
                        callBack = null;
                    } else {
                        isAsyn = isAsyn;
                        callBack = callBackFunc;
                    }
                }

                var entityObject = "";
                if (isType == "Entity") {
                    var dataSource = getDataSource(sourceName, ruleContext);
                    entityObject = vds.string.toJson(dataSource.serialize(), false);
                }

                var dataprovider = {
                    "name": sourceName,
                    "type": queryType
                };
                var modelSchema = {
                    "modelMapping": {
                        "sourceModelName": sourceName,
                        "targetModelName": entityName,
                        "fieldMappings": mappings
                    }
                }
                var command = {
                    "config": {
                        "where": whereRestrict,
                        "pageSize": pageSize,
                        "recordStart": recordStart,
                        "filterFields": null,//这里直接添加规则valueFunctions参数通用解析逻辑不解析旧直接用了之前为null值的参数
                        "tableOrQuery": tableOrQuery
                    },
                    "type": "query"
                }

                var dao = new DataAccessObject(dataprovider, modelSchema, command);
                var queryParam = {
                    "dataAccessObjects": [dao],
                    "isAsync": isAsyn,
                    "sourceType": isType,
                    "entityInfo": entityObject,
                    "callback": null
                }
                dataAdapter.queryDataSenior({
                    "config": queryParam,
                    "isAppend": false
                });
            }
        } catch (ex) {
            reject(ex);
        }
    });
};

//判断字符是否为空的方法
function isEmpty(obj) {
    if (typeof obj == "undefined" || obj == null || obj == "") {
        return true;
    } else {
        return false;
    }
}

/**
 * 获得非数据集字段的映射值
 */
var getMappings = function (fromMappings, ruleContext) {
    var returnMappings = [];
    if (!fromMappings || fromMappings.length <= 0) {
        return returnMappings;
    } else {
        for (var index = 0; index < fromMappings.length; index++) {
            var fromMapping = fromMappings[index];
            var type = fromMapping["type"];
            type = type.toString();
            var destName = fromMapping["destName"];
            var sourceName = fromMapping["sourceName"];
            var returnMapping = {};
            returnMapping["type"] = type;
            returnMapping["destName"] = destName;
            switch (type) {
                case "field":
                case "entityField":
                    //数据集字段
                    returnMapping["sourceName"] = sourceName;
                    break;
                case "expression":
                    //表达式
                    var sourceName = vds.expression.execute(sourceName, { "ruleContext": ruleContext });
                    returnMapping["sourceName"] = sourceName;
                    break;
                default:
                    break;
            }
            returnMappings.push(returnMapping);
        }
    }
    return returnMappings;
};

/**
 * desc 获取各类数据源（窗体实体、方法实体）
 * dataSourceName 数据源名称
 * routeContext 路由上下文
 * */
function getDataSource(dataSourceName, ruleContext) {
    var dsName = dataSourceName;
    var datasource = null;
    if (dsName != null && dsName != "") {
        /*本身是实体对象*/
        if (vds.ds.isDatasource(dsName)) {
            datasource = dsName;
        } else {
            /*窗体实体*/
            if (dsName.indexOf(".") == -1 && dsName.indexOf("@") == -1) {
                datasource = vds.ds.lookup(dsName);
            } else {
                /*方法实体*/
                datasource = vds.expression.execute(dsName, { "ruleContext": ruleContext });
            }
        }
    }
    if (!datasource) {
        throw vds.exception.newBusinessException("实体[" + dsName + "]不存在");
    }
    return datasource;
}

var genCustomSqlQueryParams = function (params) {
    // 构建实际查询时需要的参数对象
    var queryParams = {};
    if (params) {
        for (var key in params) {
            queryParams[key] = {};
            queryParams[key]["paramName"] = key;
            queryParams[key]["paramValue"] = params[key];
        }
    }
    return queryParams;
};


//#region genCustomParams 方法

var genCustomParams = function (paramDefines, ruleContext) {
    var rs = {};
    if (paramDefines && paramDefines.length > 0) {
        for (var i = 0; i < paramDefines.length; i++) {
            var define = paramDefines[i];
            var key = define["queryfield"];
            if (!key) {
                key = define["Queryfield"];
            }
            var valueDefine = define["queryfieldValue"];
            if (!valueDefine) {
                valueDefine = define["QueryfieldValue"];
            }
            var type = define["type"];
            var componentControlID = define["componentControlID"]
            var value = getCustomParamValue(valueDefine, type, componentControlID, ruleContext);
            rs[key] = value;
        }
    }
    return rs;
}
/**
 * 获取自定义参数的值
 * @param queryfieldValue 参数值
 * @param type 参数类源类型(参数值类型1表字段，2系统变量，3组件变量，4固定值，5自定义，6面板参数，8控件的值, 9表达式)
 * @param componentControlId 参数来源控件
 */
var getCustomParamValue = function (queryfieldValue, type, componentControlId, ruleContext) {
    var returnValue = "";

    switch (vds.string.trim(type + "")) {
        case "1":
            if (queryfieldValue.indexOf(".") == -1) {
                vds.log.warn(queryfieldValue + " 格式必须为表名.字段名");
                break;
            }
            var ds = queryfieldValue.split(".")[0];
            var fieldName = queryfieldValue.split(".")[1];
            var record = getCurrentRecord(ds);
            returnValue = record.get(fieldName);
            break;
        case "2":
            returnValue = vds.component.getVariant(queryfieldValue);
            break;
        case "3":
            returnValue = vds.window.getInput(queryfieldValue);
            break;
        case "4":
            // returnValue = queryfieldValue;
            // 固定值(0:假，1:真，2:空)
            switch ((queryfieldValue + "").toLowerCase()) {
                case "0":
                    returnValue = false;
                    break;
                case "1":
                    returnValue = true;
                    break;
                case "2":
                    returnValue = null;
                    break;
                default:
                    returnValue = queryfieldValue;
                    break;
            }
            break;
        case "5":
            returnValue = queryfieldValue;
            break;
        case "6":
            var valueQueryControlID = componentControlId;
            var value = queryfieldValue;
            var storeType = vds.widget.getStoreType(valueQueryControlID);
            var storeTypes = vds.widget.StoreType;
            // 按照控件不同的属性类型，获取参数值
            var ds = getDsName(valueQueryControlID);
            var record = getCurrentRecord(ds);
            if (storeTypes.Set == storeType) {
                // 集合类控件，组装表名.字段名进行取值
                if (record) {
                    var field = value.split("_")[1];
                    returnValue = record.get(field);
                } else {
                    vds.log.error("集合控件:" + valueQueryControlID + " 无选中行，无法获取其参数值");
                }
            } else if (storeTypes.SingleRecordMultiValue == storeType) {
                // 单记录多值控件，按照控件属性名字取得关联的标识，再进行取值
                //var propertyCode = value.split("_")[1];
                var propertyCode = "";
                // 目前认为使用-分隔，也可以使用_分隔
                if (value.indexOf("-") != -1) {
                    propertyCode = value.split("-")[1];
                } else {
                    propertyCode = value.split("_")[1];
                }
                var fieldCode = vds.widget.getProperty(valueQueryControlID, propertyCode);
                returnValue = record.get(fieldCode);
            } else if (storeTypes.SingleRecord == storeType) {
                // 单值控件，直接取值
                var fieldCode = vds.widget.getFieldCodes(ds, valueQueryControlID)[0];
                returnValue = record.get(fieldCode);
                if (null == returnValue || undefined == returnValue) {
                    returnValue = "";
                }
            }
            break;
        case "8":
        case "9":
        default:
            if (!queryfieldValue) {// modify by xiedh 2016-04-26,预先校验，防止执行表达式报错
                if (null == queryfieldValue || undefined == queryfieldValue) {
                    returnValue = null;
                } else {
                    returnValue = queryfieldValue;
                }//end modify
            } else {
                returnValue = vds.expression.execute(queryfieldValue, {
                    "ruleContext": ruleContext
                });
            }
            break;
    }
    //todo
    if (queryfieldValue !== "\"\"" && returnValue === "") {
        return null;
    }
    // 统一输出为字符串
    //return (null == returnValue || undefined == returnValue ? "" : returnValue);
    return (undefined == returnValue ? null : returnValue);
}
var getCurrentRecord = function (ds) {
    var datasource = vds.ds.lookup(ds);
    return datasource.getCurrentRecord();
}

var getDsName = function (widgetCode) {
    var dsNames = vds.widget.getDatasourceCodes(widgetCode);
    return dsNames[0];
}

//#endregion


export { main }