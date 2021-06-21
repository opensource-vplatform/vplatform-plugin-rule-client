/**
 * 流程提交
 */

	
	var jsonUtil ;
	var log ;
	var scopeManager ;
	var manager ;
	var util ;
	var ExpressionContext ;
	var engine ;
	var remoteMethodAccessor ;
	var uuid;
	exports.initModule = function(sBox){
//		 viewContext = require("system/view/viewContext");
		 scopeManager = sBox.getService("vjs.framework.extension.platform.interface.scope.ScopeManager");
//		 viewModel = require("system/view/viewModel");
		 manager = sBox.getService("vjs.framework.extension.platform.services.model.manager.datasource.DatasourceManager");
		 jsonUtil = sBox.getService("vjs.framework.extension.util.JsonUtil");
//		 log = require("system/util/logUtil");
		 log = sBox.getService("vjs.framework.extension.util.log");
//		 jsTool = require("system/util/jsTool");
		 util = sBox.getService("vjs.framework.extension.util.ArrayUtil");
//		 formulaUtil = require("system/util/formulaUtil");
		 ExpressionContext = sBox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionContext");
		 engine = sBox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionEngine");
//		 operationLib = require("system/operation/operationLib");
		 remoteMethodAccessor = sBox.getService("vjs.framework.extension.platform.services.operation.remote.RemoteMethodAccessor");
		 uuid= sBox.getService("vjs.framework.extension.util.UUID");
		 
	}
	var main = function(ruleContext) {
		var ruleInstId = ruleContext.getRuleCfg()["ruleInstId"];
		var inParams = jsonUtil.json2obj(ruleContext.getRuleCfg()["inParams"]);

		var restoreDataSrc = inParams["RestoreDataSrc"];
		var restoreDataType = inParams["RestoreDataType"];
		var restoreDataDetail = inParams["RestoreDataDetail"];

		if (restoreDataType != "JSON" && restoreDataType != "XML") {
			throw new Error("[RestoreXMLOrJSON.main]规则json配置有误,还原数据来源未设置，无法进行配置数据还原");
		}
		
		if (typeof restoreDataSrc != "string" || restoreDataSrc == "") {			
			throw new Error("[RestoreXMLOrJSON.main]规则json配置有误,数据来源表达式值不为JSON和XML，无法进行配置数据还原");
		}
		
		if (!util.isArray(restoreDataDetail) || restoreDataDetail.length <= 0) {
			throw new Error("[RestoreXMLOrJSON.main]规则json配置有误,还原数据内容未指定，无法进行配置数据还原");
		}
		
		//配置数据内容值
//		var restoreDataValue = formulaUtil.evalExpression(restoreDataSrc);
		var context = new ExpressionContext();
		context.setRouteContext(ruleContext.getRouteContext());
		var restoreDataValue = engine.execute({"expression":restoreDataSrc,"context":context});
		if (typeof restoreDataValue != "string" || restoreDataValue == "") {
			throw new Error(
				"[RestoreXMLOrJSON.main]" + 
				"执行规则配置的数据来源表达式:" + restoreDataValue + ",返回值不允许为空且必须为字符串");
		}
		
		//元素名到字段名的映射Map
		var elementNameToFieldNameMap = {};
		var elementNames = [];
		
		for (var index = 0 ; index < restoreDataDetail.length; index++) {
			var restoreDataElement = restoreDataDetail[index];
			var elementNameSrc = restoreDataElement["ElementNameSrc"];
			var elementValueDestField = restoreDataElement["ElementValueDestField"];
			
			if (typeof elementNameSrc != "string" || elementNameSrc == "") {
				throw new Error("[RestoreXMLOrJSON.main]规则json配置有误,还原数据内容中，元素名来源表达式串不允许为空且必须为字符串。");
			}
			if (typeof elementValueDestField != "string" 
				|| elementValueDestField == ""
				|| elementValueDestField.indexOf(".") == -1) {
				throw new Error(
					"[RestoreXMLOrJSON.main]" + 
					"规则json配置有误,还原数据内容中，元素值对应的实体字段未设置，或字段名格式有误。");
			}
			
//			var elementNameValue = formulaUtil.evalExpression(elementNameSrc);
			var contextSecond = new ExpressionContext();
			contextSecond.setRouteContext(ruleContext.getRouteContext());
			var elementNameValue = engine.execute({"expression":elementNameSrc,"context":contextSecond});
			if (typeof elementNameValue != "string" || elementNameValue == "") {
				throw new Error(
					"[RestoreXMLOrJSON.main]" + 
					"执行规则配置的元素名来源表达式:" + elementNameValue + ",返回值不允许为空且必须为字符串");
			}
			
			elementNameToFieldNameMap[elementNameValue] = elementValueDestField;
			elementNames.push(elementNameValue);
		}
		
		var reqData = _generateRequestData(restoreDataType, restoreDataValue, elementNames);
		
		// 构建后台规则参数
		var inParamsObj = {};
		var scope = scopeManager.getWindowScope();
		inParamsObj.moduleId = scope.getWindowCode();
//		inParamsObj.moduleId = viewContext.getModuleId();
		inParamsObj.datas = reqData;
	    
		/*
		// 后台规则获取数据
		var result = operationLib.executeRule(viewContext.getModuleId(), ruleInstId, inParamsObj);
		if (result.success != true) {
			log.error("[RestoreXMLOrJSON.main]配置数据还原规则执行失败: " + result.errorMsg);
			throw new Error("[RestoreXMLOrJSON.main]配置数据还原规则执行失败: " + result.errorMsg);
		}
		
		var responseData = result.data;
		if (!responseData) {
			log.error("[RestoreXMLOrJSON.main]配置数据还原规则执行失败，返回待还原数据值为空");
			throw new Error("[RestoreXMLOrJSON.main]配置数据还原规则执行失败，返回待还原数据值为空");
		}
		
		var jsonData = responseData;
		var elementNameToValueMap = {};
		
		for (var index = 0; index < elementNames.length; index++) {
			var elementName = elementNames[index];
			var elementValue = jsonData[elementName];
			var elementValueArr = [];
			if (jsTool.isArray(elementValue)) {				
				for (var subIndex = 0; subIndex < elementValue.length; subIndex++) {
					var elementCellValue = elementValue[subIndex];
					elementValueArr.push(elementCellValue);
				}
			} else {
				elementValueArr.push(elementValue);
			}
			elementNameToValueMap[elementName] = elementValueArr;
		}
		
		var tableToFieldArr = {};
		for (var elementName in elementNameToFieldNameMap) {
			var fieldName = elementNameToFieldNameMap[elementName];
			if (!elementNameToValueMap[elementName]) {
				continue;
			}
			var table = fieldName.substring(0, fieldName.indexOf("."));
			var field = fieldName.substring(fieldName.indexOf(".") + 1);
			if (!jsTool.isArray(tableToFieldArr[table])) {
				tableToFieldArr[table] = [];
			}
			tableToFieldArr[table].push(
				{
					"field" : field, 
					"element" : elementName
				}
			);
		}
		
		for (var table in tableToFieldArr) {
			var fieldObjArr = tableToFieldArr[table];
			fieldObjArr.sort(function(a, b) {				
				var aField = a.field;
				var aElement = a.element;
				
				var bField = b.field;
				var bElement = b.element;
				
				var aElementValueArr = elementNameToValueMap[aElement];
				var bElementValueArr = elementNameToValueMap[bElement];
				if (
					jsTool.isArray(aElementValueArr) 
					&& jsTool.isArray(bElementValueArr)) {
					if (aElementValueArr.length > bElementValueArr.length) {
						return 1;
					} else if (aElementValueArr.length < bElementValueArr.length) {
							return -1;
					} else {
							return 0;
					}
				} else if (!jsTool.isArray(aElementValueArr)) {
					return -1;
				} else if (!jsTool.isArray(bElementValueArr)) {
					return 1;
				}					
			});
			var largestSizeFieldObj = fieldObjArr[fieldObjArr.length - 1];
			var largestSizeElement = largestSizeFieldObj.element;
			var largestSizeElementValueArr = elementNameToValueMap[largestSizeElement];
			var largestSize = largestSizeElementValueArr.length;
						
			var emptyRecords = [];
			var emptyRecord = viewModel.getDataModule().createEmptyRecordByDS(table,true,true);
			for (var index = 0; index < largestSize; index++) {
				var record = emptyRecord.createNew();
				emptyRecords.push(record);
			}
									
			for (var index = 0; index < fieldObjArr.length; index++) {
				var fieldObj = fieldObjArr[index];
				var field = fieldObj.field;
				var element = fieldObj.element;
				var elementValueArr = elementNameToValueMap[element];
								
				for (var subIndex = 0; subIndex < largestSize; subIndex++) {
					if (subIndex >= elementValueArr.length) {
						break;
					}
					
					var elementValue = elementValueArr[subIndex];
					emptyRecords[subIndex].set(field, elementValue);
				}
			}
			
			var elementValue = elementValueArr[subIndex];
			viewModel.getDataModule().insertByDS(
				table, 
				emptyRecords, 
				true, 
				true);
		}
		*/
		var inputParams = {
			// ruleSetCode为活动集编号
        	"ruleSetCode" : "CommonRule_RestoreXMLOrJSON",
        	// params为活动集输入参数
         	"params" : {
         		"InParams":jsonUtil.obj2json(inParamsObj)
         	}
        };
		

		var callBackFunc = function(output) {
			ruleContext.fireRuleCallback();
			ruleContext.fireRouteCallback(output);
		}
		
		// 调用完活动集之后的回调方法
		var callback = function(responseObj){
			//var outputResult = responseObj.data.result;
			var outputResult = responseObj.OutputMessage;
			var jsonData = jsonUtil.json2obj(outputResult);
			var elementNameToValueMap = {};
			
			for (var index = 0; index < elementNames.length; index++) {
				var elementName = elementNames[index];
				var elementValue = jsonData[elementName];
				var elementValueArr = [];
				if (util.isArray(elementValue)) {
					for (var subIndex = 0; subIndex < elementValue.length; subIndex++) {
						var elementCellValue = elementValue[subIndex];
						elementValueArr.push(elementCellValue);
					}
				} else {
					elementValueArr.push(elementValue);
				}
				elementNameToValueMap[elementName] = elementValueArr;
			}
			
			var tableToFieldArr = {};
			for (var elementName in elementNameToFieldNameMap) {
				var fieldName = elementNameToFieldNameMap[elementName];
				if (!elementNameToValueMap[elementName]) {
					continue;
				}
				var table = fieldName.substring(0, fieldName.indexOf("."));
				var field = fieldName.substring(fieldName.indexOf(".") + 1);
				if (!util.isArray(tableToFieldArr[table])) {
					tableToFieldArr[table] = [];
				}
				tableToFieldArr[table].push(
					{
						"field" : field, 
						"element" : elementName
					}
				);
			}
			
			for (var table in tableToFieldArr) {
				var fieldObjArr = tableToFieldArr[table];
				fieldObjArr.sort(function(a, b) {				
					var aField = a.field;
					var aElement = a.element;
					
					var bField = b.field;
					var bElement = b.element;
					
					var aElementValueArr = elementNameToValueMap[aElement];
					var bElementValueArr = elementNameToValueMap[bElement];
					if (
						util.isArray(aElementValueArr)
						&& util.isArray(bElementValueArr)) {
						 
						if (aElementValueArr.length > bElementValueArr.length) {
							return 1;
						} else if (aElementValueArr.length < bElementValueArr.length) {
								return -1;
						} else {
								return 0;
						}
					} else if (!util.isArray(aElementValueArr)) {
						return -1;
					} else if (!util.isArray(bElementValueArr)) {
						return 1;
					}					
				});
				var largestSizeFieldObj = fieldObjArr[fieldObjArr.length - 1];
				var largestSizeElement = largestSizeFieldObj.element;
				var largestSizeElementValueArr = elementNameToValueMap[largestSizeElement];
				var largestSize = largestSizeElementValueArr.length;
							
				var emptyRecords = [];
				var datasource = manager.lookup({"datasourceName":table});
				var emptyRecord = datasource.createRecord();
//				var emptyRecord = viewModel.getDataModule().createEmptyRecordByDS(table,true,true);
				
				for (var index = 0; index < largestSize; index++) {
					//var record = emptyRecord.createNew();
					
					 var tempRecord = emptyRecord.clone();
					    if(tempRecord.getMetadata().isContainField("id")) {
					    	tempRecord.set("id",uuid.generate());
						}
					    var record = tempRecord;
					
					emptyRecords.push(record);
				}
										
				for (var index = 0; index < fieldObjArr.length; index++) {
					var fieldObj = fieldObjArr[index];
					var field = fieldObj.field;
					var element = fieldObj.element;
					var elementValueArr = elementNameToValueMap[element];
									
					for (var subIndex = 0; subIndex < largestSize; subIndex++) {
						if (subIndex >= elementValueArr.length) {
							break;
						}
						
						var elementValue = elementValueArr[subIndex];
						emptyRecords[subIndex].set(field, elementValue);
					}
				}
				
				var elementValue = elementValueArr[subIndex];
//				viewModel.getDataModule().insertByDS(
//					table, 
//					emptyRecords, 
//					true, 
//					true);
				var datasource = manager.lookup({"datasourceName":table});
				datasource.insertRecords({"records":emptyRecords});
			}
			//释放规则链
			callBackFunc();
		};
		var sConfig = {
			"isAsyn": true,
			"componentCode": scope.getComponentCode(),
			"windowCode": scope.getWindowCode(),
			"transactionId": ruleContext.getRouteContext().getTransactionId(),
			ruleSetCode: "CommonRule_RestoreXMLOrJSON",
			commitParams: [{
				"paramName": "InParams",
				"paramType": "char",
				"paramValue": inputParams.params.InParams
			}],
			afterResponse: callback
		};
		//  调用后台活动集
//		operationLib.executeRuleSet(inputParams, callback);
		remoteMethodAccessor.invoke(sConfig);
		//卡住规则链
		ruleContext.markRouteExecuteUnAuto();
	};
	
	/**
	 * 生成请求后台规则数据体
	 * @param {Object} restoreDataType
	 * @param {Object} restoreDataValue
	 * @param {Object} elementNames
	 */
	var _generateRequestData = function(restoreDataType, restoreDataValue, elementNames) {
		var reqData = {};
		reqData.restoreDataType = restoreDataType;
		reqData.restoreDataValue = restoreDataValue;
		reqData.elementNames = elementNames;
		return reqData;
	};

	exports.main = main;

export{    main}