/**
 * 从数据库获取数据到界面实体
 */

    var sandBox, jsonUtil, WhereRestrict, ExpressionContext, engine, queryConditionUtil, windowVMMappingManager, widgetContext,
        DatasourceManager, windowParam,dataAdapter,scopeManager;

    exports.initModule = function(sBox) {
        sandBox = sBox;
        jsonUtil = sBox.getService("vjs.framework.extension.util.JsonUtil");
        WhereRestrict = sBox.getService("vjs.framework.extension.platform.services.where.restrict.WhereRestrict");
        ExpressionContext = sBox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionContext");
        engine = sBox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionEngine");
        queryConditionUtil = sBox.getService("vjs.framework.extension.platform.services.where.restrict.QueryCondUtil");
        windowVMMappingManager = sBox.getService("vjs.framework.extension.platform.services.vmmapping.manager.WindowVMMappingManager");
        widgetContext = sBox.getService("vjs.framework.extension.platform.services.view.widget.common.context.WidgetContext");
        DatasourceManager = sBox.getService("vjs.framework.extension.platform.services.model.manager.datasource.DatasourceManager");
        windowParam = sBox.getService("vjs.framework.extension.platform.services.param.manager.WindowParam");
        dataAdapter = sBox.getService("vjs.framework.extension.platform.services.viewmodel.dataadapter.DataAdapter");
        scopeManager = sBox.getService("vjs.framework.extension.platform.interface.scope.ScopeManager");
        datasourceManager = sBox.getService("vjs.framework.extension.platform.services.model.manager.datasource.DatasourceManager");
    };

    var main = function(ruleContext) {
        var ruleCfgValue = ruleContext.getRuleCfg();
        var inParams = ruleCfgValue["inParams"];
        var inParamsObj = jsonUtil.json2obj(inParams);
        var routeRuntime = ruleContext.getRouteContext();
        var isAsyn = inParamsObj["isAsyn"];
        var isLocalDb = inParamsObj["isLocalDb"];
        var context = new ExpressionContext();
        context.setRouteContext(routeRuntime);

        var callBack = routeRuntime.getCallBackFunc();
        var callBackFunc = function(output) {
            if (typeof(callBack) == "function") {
                callBack.apply(routeRuntime, [routeRuntime]);
            }
        }
        var itemConfigs = inParamsObj["itemsConfig"];
        var treeStruct = inParamsObj["treeStruct"];
        var dtds = [];
        var nowDtd = null;
        for (var i = 0; i < itemConfigs.length; i++) {
            var _itemConfig = itemConfigs[i];
            var asyFun = function(itemConfig){
                var dtd = $.Deferred();
                var isType = itemConfig["Istype"];
                // 查询：1，表：0
                var queryConds = itemConfig["dsWhere"];
                // 过滤条件
                var entityName = itemConfig["entityName"];
                // 目标DB
                var targetModelType = itemConfig["entityType"];
                // 目标实体类型
                var itemqueryparam = itemConfig["itemqueryparam"];
                // 源数据中的字段
                var items = itemConfig["items"];
                // 映射关系
                var sourceName = itemConfig["sourceName"];
                // 源数据Name
                var dynamicLoad = itemConfig['dataLoad'];
                //是否自动映射字段
                var isFieldAutoMapping = itemConfig.isFieldAutoMapping === true ? true : false;
                var __isWindowRule = _isWindowRule(targetModelType);
                if (__isWindowRule) {
                    handleWindowRule(entityName);
                }
    
                //动态加载
                var mode = isCustomSqlFind ? "custom" : "table";
                var wrParam = {
                    "fetchMode": mode,
                    "routeContext": routeRuntime
                };
                var whereRestrict = WhereRestrict.init(wrParam);
                var whereRestrictNoDepthFilter = WhereRestrict.init(wrParam);
                // 处理动态加载数据
                var dynamicLoadCallBackFunc = (function(d, flag) {
                    return function() {
                        queryParam.dataAccessObjects[0].command.config.depth = dynamicLoad;
                        queryParam.dataAccessObjects[0].command.config.whereToWhere = whereRestrict.toWhere();
                        queryParam.dataAccessObjects[0].command.config.whereRestrictNoDepthFilter = whereRestrictNoDepthFilter;
                        //给方法变量赋值  (开发系统暂时没有分页配置逻辑，后期考虑)
                        if (undefined != totalRecordSave && null != totalRecordSave && totalRecordSave.length > 0) {
                            handlePagingLogic(totalRecordSave, ruleContext,entityName,targetModelType);
                        }
                        //设置为异步异步
                        //ruleContext.fireRuleCallback();
                        ruleContext.setRuleStatus(true);
                        d.resolve();
                    };
                })(dtd, isAsyn);
                var mappings = getMappings(items, context);
                var treeStructMap = handleTreeStruct(dynamicLoad, mappings, sourceName, entityName,treeStruct,isFieldAutoMapping, whereRestrict);
                // 自定义查询时，扩展的查询条件
                var extraCondition = null;
                // 根据过滤条件获取出源数据源数据
                var isCustomSqlFind = (isType + "") == "1";
                

                //判断null，如果某个过滤条件的输入参数是计算结果值为null的话，那么这个过滤条件将被忽略。
                if (undefined != queryConds && null != queryConds && queryConds.length > 0) {
                	var tmpQueryConds = [] ;
                	for(var i = 0 ; i < queryConds.length ; i++){
                		var cond = queryConds[i];
                		if(cond.operation != "is" && cond.operation != "is not" && cond.valueType== 9 ){
                			var calValue = engine.execute({
                                "expression": cond.value,
                                "context": context
                            });
                			if(calValue!=null){
                				tmpQueryConds.push(cond);
                			}
                		}else{
                			tmpQueryConds.push(cond);
                		}
                	}
                	queryConds = tmpQueryConds ;
                }
                
                if (undefined != queryConds && null != queryConds && queryConds.length > 0) {
                	
                    whereRestrict.andExtraCondition(queryConds, isCustomSqlFind ? "custom" : "table");
                    whereRestrictNoDepthFilter.andExtraCondition(queryConds, isCustomSqlFind ? "custom" : "table");
                }
    
                var params = queryConditionUtil.genCustomParams({
                    "paramDefines": itemqueryparam,
                    "routeContext": routeRuntime
                });
    
                whereRestrict.addExtraParameters(params);
                whereRestrictNoDepthFilter.addExtraParameters(params);
    
                var pagers = itemConfig["pager"];
                var isPaging;
                var pageSize = -1;
                var recordStart = -1;
                var totalRecordSave;
    
                //加载规则分页
                if (undefined != pagers && null != pagers && pagers.length > 0) {
                    var expressionContext = new ExpressionContext();
                    expressionContext.setRouteContext(ruleContext.getRouteContext());
                    var pager = pagers[0];
                    var pageNo = -1;
                    var size = -1;
                    totalRecordSave = pager.totalRecordSave;
                    isPaging = pager.isPaging;
                    if (undefined != isPaging && null != isPaging && isPaging) {
                        var pageNoTemp = engine.execute({
                            "expression": pager.pageNo,
                            "context": expressionContext
                        });
                        var pageSizeTemp = engine.execute({
                            "expression": pager.pageSize,
                            "context": expressionContext
                        });
    
                        if (pageNoTemp != null && pageNoTemp != "" && !isNaN(pageNoTemp)) {
                            pageNo = parseInt(pageNoTemp);
                        }
    
                        if (pageSizeTemp != null && pageSizeTemp != "" && !isNaN(pageSizeTemp)) {
                            size = parseInt(pageSizeTemp);
                        }
    
                        if (pageNo != -1 && size != -1) {
                            pageSize = size
                            recordStart = (pageNo - 1) * size + 1;
                        }
                    }
                }
                //分页控件分页
                if (__isWindowRule && (undefined == isPaging || null == isPaging || !isPaging)) {
                    var paginationService = sandBox.getService("vjs.framework.extension.platform.services.widget.pagination.facade");
                    var paginationObj = paginationService.getPagingInfoByDataSource(entityName);
                    recordStart = paginationObj.recordStart;
                    pageSize = paginationObj.pageSize;
                }
    
                var isCover = true;
                var callBack = callBackFunc;
    
                var queryParams = {};
                var queryType = "Table";
                if (isType == "Query") { //自定义查询
                    queryType = "Query";
                    queryParams = genCustomSqlQueryParams(whereRestrict.toParameters());
                } else{
                	queryParams = whereRestrict.toParameters();
                }
                var isComponentScope = scopeManager.isComponentScope(scopeManager.getCurrentScopeId())
                var widgetOrderInfo = [];
                if(!isComponentScope){
                	widgetOrderInfo = getWidgetOrderInfo(ruleContext, targetModelType, entityName,itemConfig,isFieldAutoMapping);
                }
                
                var orderByCfg = itemConfig["orderBy"] || [];
                if(isType == "Query"){
                	orderByCfg = [];
                }
                // 排序条件处理
                orderByCfg = getAllOrderInfo(orderByCfg,widgetOrderInfo);
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
                            whereRestrictNoDepthFilter.addOrderByDesc(orderByField);
                        } else {
                            whereRestrict.addOrderBy(orderByField);
                            whereRestrictNoDepthFilter.addOrderBy(orderByField);
                        }
                    }
                }
                if (i < itemConfigs.length - 1) {
                    callBack = null;
                } else {
                    callBack = callBackFunc;
                }
    
                var dataAdapter = sandBox.getService("vjs.framework.extension.platform.services.viewmodel.dataadapter.DataAdapter");
                var DataAccessObject = sandBox.getService("vjs.framework.extension.platform.services.repository.data.object");
    
                var dataprovider = {
                    "name": sourceName,
                    "type": queryType
                };
                var modelSchema = {
                    "modelMapping": {
                        "sourceModelName": sourceName,
                        "targetModelName": entityName,
                        "treeStruct": treeStructMap,
                        "targetModelType": targetModelType,
                        "fieldMappings": mappings,
                        "isFieldAutoMapping":isFieldAutoMapping//是否自动映射字段
                    }
                }
                var command = {
                    "config": {
                        "where": whereRestrict,
                        "pageSize": pageSize,
                        "recordStart": recordStart,
                        "filterFields": null
                    },
                    "type": "query"
                }
    
                var dao = new DataAccessObject(dataprovider, modelSchema, command);
                var queryParam = {
                    "dataAccessObjects": [dao],
                    "isAsync": i < itemConfigs.length - 1 ? false : true,
                    "callback": dynamicLoadCallBackFunc
                }
                dataAdapter.queryData({
                    "config": queryParam,
                    "isAppend": false,
                    "isConcurrent": isAsyn,
                    "routeContext": routeRuntime,
                    "isLocalDb" : true
                });
                routeRuntime.setCallBackFlag(false);
                return dtd;
            }
            if(i == 0){
                nowDtd = asyFun(_itemConfig);
            }else{
                nowDtd = nowDtd.then(function(config){
                    return function(){
                        return asyFun(config);
                    }
                }(_itemConfig));
            }
        }
        if (isAsyn) { //串行执行加载规则
            setTimeout((function(ctx) {
                return function() {
                    ctx.fireRouteCallback()
                };
            })(ruleContext), 1);
        }
        //标记规则为异步
        ruleContext.markRouteExecuteUnAuto();
        nowDtd.then((function(flag, ctx) {
            return function() {
                ctx.fireRuleCallback();
                if (!flag) {
                    ctx.fireRouteCallback();
                }
            }
        })(isAsyn, ruleContext));
        /*
        $.when.apply($.when, dtds).done((function(flag, ctx) {
            return function() {
                ctx.fireRuleCallback();
                if (!flag) {
                    ctx.fireRouteCallback();
                }
            }
        })(isAsyn, ruleContext));
        */
    };
    /**
     * 控件与规则排序信息汇总
     * @param {*} orderByCfg 
     * @param {*} widgetOrderInfo 
     */
    var getAllOrderInfo = function(orderByCfg,widgetOrderInfo){
    	var orders = widgetOrderInfo.concat(orderByCfg);
        var res = new Map();
        return orders.filter(function(item){
        	return !res.has(item.field) && res.set(item.field,1);
        })
    }
    /**
     * 处理控件上定义的排序信息
     * @param {*} ruleContext 
     * @param {*} targetModelType 
     * @param {*} entityName 
     * @param {*} itemConfig 
     */
    var getWidgetOrderInfo = function(ruleContext, targetModelType, entityName,itemConfig,isFieldAutoMapping){
    	var widgetCodes = windowVMMappingManager.getWidgetCodesByDatasourceName({
    		"datasourceName":entityName
    	});
    	var orderInfo = [];
    	for(var i = 0 ; i < widgetCodes.length; i ++){
    		var widget = widgetContext.get(widgetCodes[i],"widgetObj");
    		if(!widget){
    			continue;
    		}
    		if(widget.type == "JGDataGrid"){
    			for(var j = 0 ; j < widget.fields.length; j ++){
    				var config = {};
        			if(itemConfig.items){
        				config = itemConfig.items.find(function(item){return item.destName.split(".")[1] == widget.fields[j].name});
        			}else if(isFieldAutoMapping){
        				var datasource = datasourceManager.lookup({
        					datasourceName : entityName
        				})
        				var fields = datasource.getMetadata().fields;
        				if(fields && fields.length > 0){
        					config = fields.find(function(item){return item.code == widget.fields[j].name});
        					if(config){
        						config.sourceName = itemConfig.sourceName+"."+config.code;
        					}
        				}
        			}
    				if(config && widget.fields[j].sort){
    					var sort = widget.fields[j].sort;
    					var index = orderInfo.findIndex(function(item){return item.field == config.sourceName});
    					if(index != -1){
    						orderInfo[index] = {
								order:sort.order,
        						field:config.sourceName,
        						type:sort.type
    						}
    					}else{
    						orderInfo.push({
        						order:sort.order,
        						field:config.sourceName,
        						type:sort.type
        					});
    					}
    				}
    			}
    			orderInfo.sort(function(a,b){
    				return a.order - b.order;
    			})
    		}
    	}
    	return orderInfo;
    };
    
    /**
     * 处理返回分页逻辑
     * @param {*} totalRecordSave 
     * @param {*} ruleContext 
     * @param {*} entityName 
     * @param {*} targetModelType 
     */
    var handlePagingLogic = function(totalRecordSave, ruleContext,entityName,targetModelType){
        var totalRecordSaveObj = totalRecordSave[0];
        var isSaveTotalRecord = totalRecordSaveObj.isSaveTotalRecord;
        if (undefined != isSaveTotalRecord && null != isSaveTotalRecord && isSaveTotalRecord) {
            var dataSource = _getEntityDS(ruleContext, targetModelType, entityName);
            var amount = dataSource.getDataAmount();
            var target = totalRecordSaveObj.target;
            var targetType = totalRecordSaveObj.targetType;
            if (targetType == "methodVariant") {
                ruleContext.getRouteContext().setVariable(target, amount);
            } else if (targetType == "methodOutput") {
                ruleContext.getRouteContext().setOutputParam(target, amount);
            } else if (targetType == "windowInput") {
                windowParam.setInput({
                    "code": target,
                    "value": amount
                });
            } else if (targetType == "windowOutput") {
                windowParam.setOutput({
                    "code": target,
                    "value": amount
                });
            }
        }
    }
    /**
     * 处理树结构
     * @param {*} dynamicLoad 
     * @param {*} mappings 
     * @param {*} sourceName 
     * @param {*} entityName 
     * @param {*} treeStruct 
     * @param {*} isFieldAutoMapping 
     * @param {*} whereRestrict 
     */
    var handleTreeStruct = function(dynamicLoad, mappings, sourceName, entityName,treeStruct,isFieldAutoMapping, whereRestrict){
        var treeStructMap;
        if (dynamicLoad != null && dynamicLoad != '-1' && dynamicLoad != '0') {
            var treeStructMap = _getTreeStruct(entityName, treeStruct);
            if (treeStructMap != null) {
                //var treeStructJson = encodeURIComponent(jsonUtil.obj2json(treeStructMap));
                //将实体的树结构转为表的树结构
                var sourceTreeStruct = dest2SourceTreeStruct(mappings,treeStructMap,{
                    isFieldAutoMapping : isFieldAutoMapping
                });
                var treeStructJson = encodeURIComponent(jsonUtil.obj2json(sourceTreeStruct));
                var whereObj = {
                    condition: whereRestrict.toWhere(),
                    parameters: whereRestrict.toParameters()
                }
                var whereObjJson = encodeURIComponent(jsonUtil.obj2json(whereObj));

                var expression = 'DynamicLoadCondition(\"' + sourceName + '\",\"' + dynamicLoad + '\", \"' + treeStructJson + '\",\"' + whereObjJson + '\")';

                var dynamicCondition = engine.execute({
                    "expression": expression,
                    "context": new ExpressionContext()
                });

                if (dynamicCondition && dynamicCondition != "") {
                    //var eventName = whereRestrict.EVENT_AFTER_FIND;
                    whereRestrict.andConditionString("(" + dynamicCondition + ")");
                }
            }
        }
        return treeStructMap;
    }
    /*
     * 判断当前规则是否为窗体规则、或者构建方法规则
     */
    var _isWindowRule = function(entityType) {
        var _isWinRule = true;
        switch (entityType) {
            case "ruleSetInput":
                _isWinRule = false;
                break;
            case "ruleSetOutput":
                _isWinRule = false;
                break;
            case "ruleSetVar":
                _isWinRule = false;
                break;
            case "windowInput":
                _isWinRule = false;
                break;
            case "windowOutput":
                _isWinRule = false;
                break;
            default:
                ;
        }
        return _isWinRule;
    };

    var handleWindowRule = function(entityName){
        // 处理列表过滤条件重置
        var _filterEntity = {
            "datasourceName": entityName
        }
        var widgetCodes = windowVMMappingManager.getWidgetCodesByDatasourceName(_filterEntity);
        // 处理窗体输入或者输出实体不支持绑定控件过滤条件
        if (widgetCodes && widgetCodes.length > 0) {
            for (var j = 0, len = widgetCodes.length; j < len; j++) {
                var widget = widgetContext.get(widgetCodes[j], "widgetObj");
                if (widget && widget._filterFields)
                    widget._filterFields = null
            }
        }
    }
    /*
     * 获取树结构信息
     */
    var _getTreeStruct = function(tableName, treeStructMaps) {
        if (treeStructMaps == null)
            return null;
        for (var i = 0; i < treeStructMaps.length; i++) {
            var treeStructMap = treeStructMaps[i];
            if (treeStructMap != null && treeStructMap.tableName == tableName) {
                return treeStructMap;
            }
        }
        return null;
    };

    /**
     * 获得非数据集字段的映射值
     */
    var getMappings = function(fromMappings, context) {
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
                        //sourceName = formulaUtil.evalExpression(sourceName);
                        sourceName = engine.execute({
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

	// 将实体的树结构转为表的树结构
	var dest2SourceTreeStruct = function(mappings, treeStructMap, params) {
		// 获取字段映射关系
		var mappingFields = [];
		for (var i = 0; i < mappings.length; i++) {
			var item = mappings[i];
			var type = item["type"];
			if (type == 'entityField') {
				var destName1 = item["destName"].split(".")[1];
				var sourceName1 = item["sourceName"].split(".")[1];
				var fieldMap = new Object();
				fieldMap.destName = destName1;
				fieldMap.sourceName = sourceName1;
				mappingFields.push(fieldMap);
			}
		}
		var newSourceTreeStructMap = new Object();
		var isFieldAutoMapping = params && params.isFieldAutoMapping;
		// 转实体的表结构为表的树结构
		for ( var p in treeStructMap) {
			var isMappingExist = true;
			var item = treeStructMap[p];
			newSourceTreeStructMap[p] = item;
			if (p == 'pidField' || p == 'treeCodeField'
					|| p == 'orderField' || p == 'isLeafField') {
				isMappingExist = checkMappingExist(item, mappingFields);
			}
			if (item != "") {
				if (isMappingExist || isFieldAutoMapping) {
					for (var i = 0; i < mappingFields.length; i++) {
						if (item == mappingFields[i]["destName"]) {
							newSourceTreeStructMap[p] = mappingFields[i]["sourceName"]
							break;
						}
					}
				} else {
					throw new Error("树结构字段[" + p + "]的映射[" + newSourceTreeStructMap[p] + "]不存在");
				}
			}
		}
		return newSourceTreeStructMap;
	}

	// 判断树结构的映射字段是否存在
	var checkMappingExist = function(item, mappingFields) {
		for (var i = 0; i < mappingFields.length; i++) {
			if (item == mappingFields[i]["destName"]) {
				return true;
			}
		}
		return false;
	}
	
    var genCustomSqlQueryParams = function(params) {
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

    // 获取实体数据源
    var _getEntityDS = function(ruleContext, entityType, entityName) {
        var ds;

        if (entityType == "window") {
            var ds = DatasourceManager.lookup({ "datasourceName": entityName });
        } else if (entityType == "windowInput") {
            ds = windowParam.getInput({ "code": entityName });
        } else if (entityType == "windowOutput") {
            ds = windowParam.getOutput({ "code": entityName });
        } else if (entityType == "ruleSetInput") {
            ds = ruleContext.getRouteContext().getInputParam(entityName);
        } else if (entityType == "ruleSetOutput") {
            ds = ruleContext.getRouteContext().getOutPutParam(entityName);
        } else if (entityType == "ruleSetVar") {
            ds = ruleContext.getRouteContext().getVariable(entityName);
        }

        if (undefined == ds)
            throw new Error("找不到类型为[" + entityType + "]的实体：" + entityName);

        return ds;
    }
    
    var removeNullCondition = function(queryConds){
    	var result = [] ;
    	if (undefined != queryConds && null != queryConds && queryConds.length > 0) {
        	for(var i = 0 ; i < queryConds.length ; i++){
        		var cond = queryConds[i];
        		var valueQueryControlID = !cond["valueQueryControlID"] ? "" : cond["valueQueryControlID"];
        		var valueObj = queryConditionUtil.getCondRight(cond["value"], cond["valueType"], cond["columnType"], cond["operation"], valueQueryControlID);
                if(valueObj == null ){
                	result.push(cond);
                }
        	}
        }
    	return result;
    }

    exports.main = main;

export{    main}