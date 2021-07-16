/**
 * 从数据库获取数据到界面实体
 */

var widgetContext, paginationService, DataAccessObject;

exports.initModule = function (sBox) {
    widgetContext = sBox.getService("vjs.framework.extension.platform.services.view.widget.common.context.WidgetContext");
    paginationService = sBox.getService("vjs.framework.extension.platform.services.widget.pagination.facade");
    DataAccessObject = sBox.getService("vjs.framework.extension.platform.services.repository.data.object");
};

vds.import("vds.object.*", "vds.exception.*", "vds.expression.*", "vds.message.*", "vds.ds.*");

var main = function (ruleContext) {
    return new Promise(function (resolve, reject) {
        try {
            var inParamsObj = ruleContext.getVplatformInput();
            var routeRuntime = ruleContext.getRouteContext();
            var isAsyn = inParamsObj["isAsyn"];
            var callBack = routeRuntime.getCallBackFunc();
            var callBackFunc = function (output) {
                if (typeof (callBack) == "function") {
                    callBack.apply(routeRuntime, [routeRuntime]);
                }
            }
            var itemConfigs = inParamsObj["itemsConfig"];
            var treeStruct = inParamsObj["treeStruct"];
            var dtds = [];
            var nowDtd = null;
            for (var i = 0; i < itemConfigs.length; i++) {
                var _itemConfig = itemConfigs[i];
                var asyFun = function (itemConfig) {
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
                    var isCustomSqlFind = (isType + "") == "1";
                    var mode = isCustomSqlFind ? vds.ds.WhereType.Query : vds.ds.WhereType.Table;
                    var wrParam = {
                        "type": mode,
                        "methodContext": ruleContext.getMethodContext()
                    };
                    var whereRestrict = vds.ds.createWhere(wrParam);
                    var whereRestrictNoDepthFilter = vds.ds.createWhere(wrParam);
                    // 处理动态加载数据
                    var dynamicLoadCallBackFunc = (function (d, flag) {
                        return function () {
                            queryParam.dataAccessObjects[0].command.config.depth = dynamicLoad;
                            queryParam.dataAccessObjects[0].command.config.whereToWhere = whereRestrict.toWhere();
                            queryParam.dataAccessObjects[0].command.config.whereRestrictNoDepthFilter = whereRestrictNoDepthFilter;
                            //给方法变量赋值  (开发系统暂时没有分页配置逻辑，后期考虑)
                            if (undefined != totalRecordSave && null != totalRecordSave && totalRecordSave.length > 0) {
                                handlePagingLogic(totalRecordSave, ruleContext, entityName, targetModelType);
                            }
                            //设置为异步异步
                            d.resolve();
                        };
                    })(dtd, isAsyn);
                    var mappings = getMappings(items, ruleContext);
                    var treeStructMap = handleTreeStruct(dynamicLoad, mappings, sourceName, entityName, treeStruct, isFieldAutoMapping, whereRestrict);
                    // 自定义查询时，扩展的查询条件
                    var extraCondition = null;
                    // 根据过滤条件获取出源数据源数据
                    if (undefined != queryConds && null != queryConds && queryConds.length > 0) {
                        whereRestrict.addCondition(queryConds);
                        whereRestrictNoDepthFilter.addCondition(queryConds);
                    }

                    var params = genCustomParams(itemqueryparam,ruleContext);

                    whereRestrict.addParameters(params);
                    whereRestrictNoDepthFilter.addParameters(params);

                    var pagers = itemConfig["pager"];
                    var isPaging;
                    var pageSize = -1;
                    var recordStart = -1;
                    var totalRecordSave;

                    //加载规则分页
                    if (undefined != pagers && null != pagers && pagers.length > 0) {
                        var pager = pagers[0];
                        var pageNo = -1;
                        var size = -1;
                        totalRecordSave = pager.totalRecordSave;
                        isPaging = pager.isPaging;
                        if (undefined != isPaging && null != isPaging && isPaging) {
                            var pageNoTemp = vds.expression.execute(pager.pageNo, { "ruleContext": ruleContext });
                            var pageSizeTemp = vds.expression.execute(pager.pageSize, { "ruleContext": ruleContext });

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
                    } else {
                        queryParams = whereRestrict.toParameters();
                    }

                    var widgetOrderInfo = getWidgetOrderInfo(ruleContext, targetModelType, entityName, itemConfig, isFieldAutoMapping);

                    var orderByCfg = itemConfig["orderBy"] || [];
                    if (isType == "Query") {
                        orderByCfg = [];
                    }
                    // 排序条件处理
                    orderByCfg = getAllOrderInfo(orderByCfg, widgetOrderInfo);
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
                            "isFieldAutoMapping": isFieldAutoMapping//是否自动映射字段
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
                    vds.rpc.queryData({
                        "config": queryParam,
                        "isAppend": false,
                        "isConcurrent": isAsyn,
                        "routeContext": routeRuntime
                    });
                    return dtd;
                }
                if (i == 0) {
                    nowDtd = asyFun(_itemConfig);
                } else {
                    nowDtd = nowDtd.then(function (config) {
                        return function () {
                            return asyFun(config);
                        }
                    }(_itemConfig));
                }
            }
            if (isAsyn) { //串行执行加载规则
                setTimeout((function (ctx) {
                    return function () {
                        ctx.fireRouteCallback()
                    };
                })(ruleContext), 1);
            }
            nowDtd.then((function (flag, ctx) {
                return function () {
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
        } catch (ex) {
            reject(ex);
        }
    });
};
/**
* 控件与规则排序信息汇总
* @param {*} orderByCfg 
* @param {*} widgetOrderInfo 
*/
var getAllOrderInfo = function (orderByCfg, widgetOrderInfo) {
    var orders = widgetOrderInfo.concat(orderByCfg);
    var res = new Map();
    return orders.filter(function (item) {
        return !res.has(item.field) && res.set(item.field, 1);
    })
}
/**
* 处理控件上定义的排序信息
* @param {*} ruleContext 
* @param {*} targetModelType 
* @param {*} entityName 
* @param {*} itemConfig 
*/
var getWidgetOrderInfo = function (ruleContext, targetModelType, entityName, itemConfig, isFieldAutoMapping) {
    var orderInfo = [];
    var widgetCodes = vds.widget.getWidgetCodes(entityName);
    if (!widgetCodes) {
        return orderInfo;
    }
    for (var i = 0; i < widgetCodes.length; i++) {
        var widget = widgetContext.get(widgetCodes[i], "widgetObj");
        if (!widget) {
            continue;
        }
        if (widget.type == "JGDataGrid") {
            for (var j = 0; j < widget.fields.length; j++) {
                var config = {};
                if (itemConfig.items) {
                    config = itemConfig.items.find(function (item) { return item.destName.split(".")[1] == widget.fields[j].name });
                } else if (isFieldAutoMapping) {
                    var datasource = vds.ds.lookup(entityName)
                    var fields = datasource.getMetadata().fields;
                    if (fields && fields.length > 0) {
                        config = fields.find(function (item) { return item.code == widget.fields[j].name });
                        if (config) {
                            config.sourceName = itemConfig.sourceName + "." + config.code;
                        }
                    }
                }
                if (config && widget.fields[j].sort) {
                    var sort = widget.fields[j].sort;
                    var index = orderInfo.findIndex(function (item) { return item.field == config.sourceName });
                    if (index != -1) {
                        orderInfo[index] = {
                            order: sort.order,
                            field: config.sourceName,
                            type: sort.type
                        }
                    } else {
                        orderInfo.push({
                            order: sort.order,
                            field: config.sourceName,
                            type: sort.type
                        });
                    }
                }
            }
            orderInfo.sort(function (a, b) {
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
var handlePagingLogic = function (totalRecordSave, ruleContext, entityName, targetModelType) {
    var totalRecordSaveObj = totalRecordSave[0];
    var isSaveTotalRecord = totalRecordSaveObj.isSaveTotalRecord;
    if (undefined != isSaveTotalRecord && null != isSaveTotalRecord && isSaveTotalRecord) {
        var dataSource = _getEntityDS(ruleContext, targetModelType, entityName);
        var amount = dataSource.getDataAmount();
        var target = totalRecordSaveObj.target;
        var targetType = totalRecordSaveObj.targetType;
        if (targetType == "methodVariant") {
            ruleContext.getMethodContext().setVariable(target, amount);
        } else if (targetType == "methodOutput") {
            ruleContext.getMethodContext().setOutput(target, amount);
        } else if (targetType == "windowInput") {
            vds.window.setInput(target, amount);
        } else if (targetType == "windowOutput") {
            vds.window.setOutput(target, amount);
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
var handleTreeStruct = function (dynamicLoad, mappings, sourceName, entityName, treeStruct, isFieldAutoMapping, whereRestrict) {
    var treeStructMap;
    if (dynamicLoad != null && dynamicLoad != '-1' && dynamicLoad != '0') {
        var treeStructMap = _getTreeStruct(entityName, treeStruct);
        if (treeStructMap != null) {
            //var treeStructJson = encodeURIComponent(vds.string.toJson(treeStructMap));
            //将实体的树结构转为表的树结构
            var sourceTreeStruct = dest2SourceTreeStruct(mappings, treeStructMap, {
                isFieldAutoMapping: isFieldAutoMapping
            });
            var treeStructJson = encodeURIComponent(vds.string.toJson(sourceTreeStruct));
            var whereObj = {
                condition: whereRestrict.toWhere(),
                parameters: whereRestrict.toParameters()
            }
            var whereObjJson = encodeURIComponent(vds.string.toJson(whereObj));

            var expression = 'DynamicLoadCondition(\"' + sourceName + '\",\"' + dynamicLoad + '\", \"' + treeStructJson + '\",\"' + whereObjJson + '\")';

            var dynamicCondition = vds.expression.execute(expression, { "ruleContext": ruleContext });

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
var _isWindowRule = function (entityType) {
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

var handleWindowRule = function (entityName) {
    // 处理列表过滤条件重置
    var _filterEntity = {
        "datasourceName": entityName
    }
    var widgetCodes = vds.widget.getWidgetCodes(_filterEntity);
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
var _getTreeStruct = function (tableName, treeStructMaps) {
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
                    //sourceName = formulaUtil.evalExpression(sourceName);
                    sourceName = vds.expression.execute(sourceName, { "ruleContext": ruleContext });
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
var dest2SourceTreeStruct = function (mappings, treeStructMap, params) {
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
    for (var p in treeStructMap) {
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
var checkMappingExist = function (item, mappingFields) {
    for (var i = 0; i < mappingFields.length; i++) {
        if (item == mappingFields[i]["destName"]) {
            return true;
        }
    }
    return false;
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

// 获取实体数据源
var _getEntityDS = function (ruleContext, entityType, entityName) {
    var ds;

    if (entityType == "window") {
        var ds = vds.ds.lookup(entityName);
    } else if (entityType == "windowInput") {
        ds = vds.window.getInput(entityName);
    } else if (entityType == "windowOutput") {
        ds = vds.window.getOutput(entityName);
    } else if (entityType == "ruleSetInput") {
        ds = ruleContext.getMethodContext().getInput(entityName);
    } else if (entityType == "ruleSetOutput") {
        ds = ruleContext.getMethodContext().getOutPut(entityName);
    } else if (entityType == "ruleSetVar") {
        ds = ruleContext.getMethodContext().getVariable(entityName);
    }

    if (undefined == ds)
        throw new Error("找不到类型为[" + entityType + "]的实体：" + entityName);

    return ds;
}

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