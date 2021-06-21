/**
 * 加载动态交叉表到实体
 */


    var jsonUtil;
    var stringUtil;
    var WhereRestrict;
    var uuidUtil;
    var sandBox;
    var ExpressionContext;
    var engine;
    var util;
    var paginationService;
    var dataAdapter;
    var DataAccessObject;
    var formulaEngine;
    var ExpressionContext1;
    var manager,
        DBFactory,
        factory;

    exports.initModule = function (sBox) {
        jsonUtil = sBox.getService("vjs.framework.extension.util.JsonUtil");
        stringUtil = sBox.getService("vjs.framework.extension.util.StringUtil");
        WhereRestrict = sBox.getService("vjs.framework.extension.platform.services.where.restrict.WhereRestrict");
        formulaEngine = sBox.getService("vjs.framework.extension.platform.engine.expression.ExpressionEngine");
        ExpressionContext1 = sBox.getService("vjs.framework.extension.platform.engine.expression.ExpressionContext");
        //         formulaUtil = require("system/util/formulaUtil");
        ExpressionContext = sBox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionContext");
        engine = sBox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionEngine");

        //         queryConditionUtil = require("system/util/queryConditionUtil");
        util = sBox.getService("vjs.framework.extension.platform.services.where.restrict.QueryCondUtil");

        uuidUtil = sBox.getService("vjs.framework.extension.util.UUID");

        paginationService = sBox.getService("vjs.framework.extension.platform.services.widget.pagination.facade");
        dataAdapter = sBox.getService("vjs.framework.extension.platform.services.viewmodel.dataadapter.DataAdapter");
        DataAccessObject = sBox.getService("vjs.framework.extension.platform.services.repository.data.object");

        manager = sBox.getService("vjs.framework.extension.platform.services.model.manager.datasource.DatasourceManager");
        DBFactory = sBox.getService("vjs.framework.extension.platform.interface.model.datasource.DatasourceFactory");
        factory = sBox.getService("vjs.framework.extension.platform.interface.exception.ExceptionFactory");

    };
    //判断字符是否为空的方法
    function isEmpty(obj) {
        if (typeof obj == "undefined" || obj == null || obj == "") {
            return true;
        } else {
            return false;
        }
    }
    //规则主入口(必须有)
    var main = function (ruleContext) {
        //获取规则上下文中的规则配置值
        var ruleCfgValue = ruleContext.getRuleCfg();
        var inParams = ruleCfgValue["inParams"];
        var inParamsObj = jsonUtil.json2obj(inParams);

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
                        var expContext = {};
                        var context = new ExpressionContext1();
                        context.setRouteContext(ruleContext.getRouteContext());
                        if (!isEmpty(columnValue)) {
                            columnValue = formulaEngine.execute({
                                "expression": columnValue,
                                "context": context
                            });
                            columntableOrQuery["paramsValue"] = columnValue;
                        }
                    }
                    if (columnName == 'isEmptyToProduceDynamicCol') {
                        var context = new ExpressionContext1();
                        context.setRouteContext(ruleContext.getRouteContext());
                        if (!isEmpty(columnValue)) {
                            columntableOrQuery["paramsValue"] = formulaEngine.execute({
                                "expression": columnValue,
                                "context": context
                            });
                        }
                    }
                }
                if(valueFunctions!=null){                	
                	var entityObject = jsonUtil.obj2json(valueFunctions, false);
                	var values={"paramsName":"valueFunctions","paramsValue":entityObject};
                	tableOrQuery.push(values);
                }
            }

            //映射关系
            var sourceName = itemConfig["sourceName"];
            //源数据Name
            //处理非数据集字段的映射值
            var mappings = getMappings(items);
            // 自定义查询时，扩展的查询条件
            var extraCondition = null;
            // 根据过滤条件获取出源数据源数据
            var isCustomSqlFind = (isType + "") == "1";
            var whereRestrict = WhereRestrict.init(isCustomSqlFind ? "custom" : "table");
            if (undefined != queryConds && null != queryConds && queryConds.length > 0) {
                whereRestrict.andExtraCondition(queryConds, isCustomSqlFind ? "custom" : "table");
            }

            //            var params = queryConditionUtil.genCustomParams(itemqueryparam);
            params = util.genCustomParams({
                "paramDefines": itemqueryparam,
                "routeContext": ruleContext.getRouteContext()
            });

            whereRestrict.addExtraParameters(params);

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
                //viewModel.getDataModule().loadDataByDSWithOtherCustomQuery(entityName, sourceName, queryParams, whereRestrict.toWhere(), mappings, loadParam);
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

                // var tableOrQuery = itemConfig["tableOrQuery"];
            }

            var entityObject = "";
            if (isType == "Entity") {
                var dataSource = getDataSource(sourceName, routeRuntime);
                entityObject = jsonUtil.obj2json(dataSource.serialize(), false);
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
            routeRuntime.setCallBackFlag(false);
        }
    };
    /**
     * desc Json字符串转Json对象
     * inParams 
     * vjs:
     * 		"vjs.framework.extension.util.json":null,
     * services:
     * 		jsonUtil = sandbox.getService("vjs.framework.extension.util.JsonUtil");
     * */
    var convertJson = function (inParams) {
        var result = {};
        if (undefined != inParams) {
            result = jsonUtil.json2obj(inParams);
        }
        return result;
    }
    /**
     * 获得非数据集字段的映射值
     */
    var getMappings = function (fromMappings) {
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
                        //                        sourceName = formulaUtil.evalExpression(sourceName);
                        var context = new ExpressionContext();
                        var sourceName = engine.execute({
                            "expression": sourceName,
                            "context": context
                        });

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
     * vjs: 
     * 		"vjs.framework.extension.platform.interface.exception":null,
     * 		"vjs.framework.extension.platform.services.model.manager.datasource":null
     * services: 
     * 		manager = sandbox.getService("vjs.framework.extension.platform.services.model.manager.datasource.DatasourceManager");
     * 		DBFactory = sandbox.getService("vjs.framework.extension.platform.interface.model.datasource.DatasourceFactory");
     * 		ExpressionContext = sandbox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionContext");
     * 		engine = sandbox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionEngine");
     * */
    function getDataSource(dataSourceName, routeContext) {
        var dsName = dataSourceName;
        var datasource = null;
        if (dsName != null && dsName != "") {
            /*本身是实体对象*/
            if (DBFactory.isDatasource(dsName)) {
                datasource = dsName;
            } else {
                var context = new ExpressionContext();
                context.setRouteContext(routeContext);
                /*窗体实体*/
                if (dsName.indexOf(".") == -1 && dsName.indexOf("@") == -1) {
                    datasource = manager.lookup({
                        "datasourceName": dsName
                    });
                } else {
                    /*方法实体*/
                    datasource = engine.execute({
                        "expression": dsName,
                        "context": context
                    });
                }
            }
        }
        if (!datasource) {
            HandleException("实体[" + dsName + "]不存在");
        }
        return datasource;
    }

    /**
     * desc 非回调中抛异常
     * @ruleContext 规则上下文
     * @error_msg 提示信息
     * vjs: 可省略
     * services: 
     * 		factory = sandbox.getService("vjs.framework.extension.platform.interface.exception.ExceptionFactory");
     * */
    function HandleException(error_msg) {
        var exception = factory.create({
            "type": factory.TYPES.Business,
            "message": error_msg
        });
        throw exception;
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

    //注册规则主入口方法(必须有)
    exports.main = main;

export{    main}