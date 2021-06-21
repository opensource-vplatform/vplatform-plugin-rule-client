/**
 *界面实体与物理表数据比较
 * shenxiangz
 *
 * 
 */

	//加载
	var log ;
	var stringUtil;
	var mapUtil;
	var jsonUtil;
	var whereRestrict;
	var viewModel;
	var viewContextManager;
	var queryConditionUtil;
	var operationLib;
	var ExpressionContext;
	var engine;
	var scopeManager;
	var util;
	var remoteMethodAccessor;
	var pusher;
	var manager;
	var enums;
	var uuid;
	
	exports.initModule = function(sBox){
		log = sBox.getService("vjs.framework.extension.util.log");
		 stringUtil = sBox.getService("vjs.framework.extension.util.StringUtil");
		 mapUtil = sBox.getService("vjs.framework.extension.util.MapUtil");
		 jsonUtil = sBox.getService("vjs.framework.extension.util.JsonUtil");	
		// whereRestrict = require("system/util/WhereRestrict");	
		 whereRestrict = sBox.getService("vjs.framework.extension.platform.services.where.restrict.WhereRestrict");
		// formulaUtil = require("system/util/formulaUtil");
		 ExpressionContext = sBox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionContext");
		 engine = sBox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionEngine");
		 
//		 viewModel = require("system/view/viewModel");	
		 enums = sBox.getService("vjs.framework.extension.platform.interface.enum.DatasourceEnums");
		 
//		 viewContextManager = require("system/manager/viewContextManager");	
		 scopeManager = sBox.getService("vjs.framework.extension.platform.interface.scope.ScopeManager");
		 
//		 queryConditionUtil = require("system/util/queryConditionUtil");
		 util = sBox.getService("vjs.framework.extension.platform.services.where.restrict.QueryCondUtil");
		 
//		 operationLib = require("system/operation/operationLib");
		 remoteMethodAccessor = sBox.getService("vjs.framework.extension.platform.services.operation.remote.RemoteMethodAccessor");
		 
		 pusher = sBox.getService("vjs.framework.extension.platform.services.domain.datasource.DatasourcePusher");
		 uuid= sBox.getService("vjs.framework.extension.util.UUID");
		 manager = sBox.getService("vjs.framework.extension.platform.services.model.manager.datasource.DatasourceManager");
		 
	}
			// 规则主入口(必须有)
			var main = function(ruleContext) {
				// 当任何一条匹配数据不满足比较条件时，返回false，否则返回true(包括两种情况：不存在匹配数据或所有匹配数据都满足比较条件)；
				var bussinessReturnValue = true;

				var ruleCfg = ruleContext.getRuleCfg();
				var paramsValue = ruleCfg["inParams"];
				var ruleInstId = ruleCfg["ruleInstId"];// 规则ID
//				var moduleId = viewContextManager.getModuleId();
				var scope = scopeManager.getScope();
				//var moduleId = scope.getWindowCode();
				var routeRuntime = ruleContext.getRouteContext();
				var params = jsonUtil.json2obj(paramsValue);
				var srcDataSource = params["srcDataSource"];
				var srcFilterCondition = params["srcFilterCondition"];
				var destDataSource = params["destDataSource"];
				var destIsQuery = params["destIsQuery"];
				var destFilterCondition = params["destFilterCondition"];
				var destQueryParams = params["destQueryParams"];

				var matchFields = params["matchFields"];

				var compareCondition = params["compareCondition"];

				if (compareCondition == null) {
					throw new Error("比较条件配置不能为空，请检查配置！");
				}

				var srcCompareField = compareCondition["srcField"];
				var destCompareField = compareCondition["destField"];
				var isMergeRepeatData = compareCondition["isMergeRepeatData"];
				var operator = compareCondition["compareOperator"];

//				var idField = viewModel.getConstModule().getIDField();
				var idField = enums.IDFIELD;

				if (operator == null || operator == "") {
					throw new Error("比较操作符不能为空，请检查配置！");
				}
				if (srcCompareField == null || srcCompareField == "") {
					throw new Error("源实体比较字段不能为空，请检查配置！");
				}
				if (destCompareField == null || destCompareField == "") {
					throw new Error("目标实体比较字段不能为空，请检查配置！");
				}

				// 源实体比较字段类型必须与目标实体比较字段类型兼容
				var numberTypeArray = [ "integer", "number" ];
				var srcCompareFieldType = getFieldByDataSource(srcDataSource,
						srcCompareField).type;

				if (!stringUtil.isInArray(srcCompareFieldType, numberTypeArray)) {
					throw new Error("源实体比较字段必须为整数或数字类型，请检查配置！");
				}

				var result = params["result"];
				var isSave = result["isSave"];
				var isClearSaveData = result["isClearSaveData"];
				var saveDataSource = result["saveDataSource"];
				var mappings = result["mappings"];

				if (stringUtil.isEmpty(srcDataSource)
						|| stringUtil.isEmpty(destDataSource)) {
					throw new Error("源实体或物理表及查询不能为空，请检查配置！");
				}

				if (srcDataSource != destDataSource) {
					var errorMsg = null;
					if (matchFields == null || matchFields.length == 0) {
						errorMsg = "匹配字段不能为空，请检查配置！";
					}
					for ( var i = 0; i < matchFields.length; i++) {
						var obj = matchFields[i];
						if (obj == null) {
							errorMsg = "匹配字段不能为空，请检查配置！";
							break;
						}
						if (stringUtil.isEmpty(obj["srcField"])) {
							errorMsg = "匹配源字段不能为空，请检查配置！";
							break;
						}
						if (stringUtil.isEmpty(obj["destField"])) {
							errorMsg = "匹配目标字段不能为空，请检查配置！";
							break;
						}

					}
					if (errorMsg != null) {
						throw new Error(errorMsg);
					}
				}
				try {
					validSaveMapping(isSave, mappings);
				} catch (e) {
					throw new Error("存储实体字段映射不能为空，请检查配置！");
				}

				if (isSave) {
					if (stringUtil.isEmpty(saveDataSource)) {
						throw new Error("存储实体不能为空，请检查配置！");
					}
					if (saveDataSource == srcDataSource) {
						throw new Error("存储实体不能为源实体，请检查配置！");
					}
				}

				var srcRecords = getFilterRecords(srcDataSource, srcFilterCondition,ruleContext);
				if (srcRecords == null || srcRecords.length == 0) {
					setBusinessRuleResult(ruleContext, true);
					if (isSave && isClearSaveData)
//						viewModel.getDataModule().removeAllRecordsByDS(saveDataSource);
						pusher.removeAllRecords({"datasourceName":saveDataSource});
					return true;
				}
				var destQueryCond = {};
				destQueryCond.srcDataSource = srcDataSource;
				destQueryCond.destDataSource = destDataSource;
				destQueryCond.destIsQuery = destIsQuery;

				var fetchMode = destIsQuery ? "custom" : "table";
				var wrParam = {
						"fetchMode": fetchMode,
						"routeContext": routeRuntime
					};
				var w = whereRestrict.init(wrParam);

				// 组装设置的加载条件
				if (destFilterCondition && destFilterCondition.length > 0) {
					w.andExtraCondition(destFilterCondition, fetchMode);
				}
				if (destQueryParams != null && destQueryParams.length > 0) {
//					var tmpparams = queryConditionUtil.genCustomParams(destQueryParams);
					var tmpparams = util.genCustomParams({"paramDefines":destQueryParams,"routeContext":ruleContext.getRouteContext()});
					w.addExtraParameters(tmpparams);
				}
				var condition = w.toWhere();
				var valueParamMap = w.toParameters();
				destQueryCond.destWhere = condition;
				destQueryCond.destQueryParams = valueParamMap;

				destQueryCond.srcValues = srcRecords;
				destQueryCond.matchFields = matchFields;

				var cloneCompareCondition = cloneObj(compareCondition);
				var srcField = getFieldByDataSource(srcDataSource, srcCompareField);
				cloneCompareCondition.srcColumnTypeName = srcField.type;
				destQueryCond.compareCondition = cloneCompareCondition;

				// var result =
				// operationLib.executeRule(viewContext.getModuleId(),
				// ruleCfg.ruleInstId, destQueryCond);
				// if (result.success) {
				// finalResults=result.data;
				//		   
				// if(isSave){
				// if(isClearSaveData)
				// viewModel.getDataModule().removeAllRecordsByDS(saveDataSource);
				// //获取构造的存储实体数据
				// if(finalResults!=null && finalResults.length>0){
				// var
				// newSaveRecords=getCopyRecordsByMapping(saveDataSource,finalResults,mappings);
				// viewModel.getDataModule().insertByDS(saveDataSource,newSaveRecords);
				// }
				// }
				// if(finalResults!=null &&
				// finalResults.length==srcRecords.length)
				// bussinessReturnValue=true;
				// else
				// bussinessReturnValue=false;
				//			
				// setBusinessRuleResult(ruleContext,bussinessReturnValue);
				//			
				// } else {
				// log.error("错误信息："+result.msg);
				// throw new Error("数据比较执行异常！");
				// }

				var inputParams = {
					// ruleSetCode为活动集编号
					"ruleSetCode" : "CommonRule_CompareEntityAndTableData",
					// params为活动集输入参数
					"params" : {
						"InParams" : jsonUtil.obj2json(destQueryCond)
					}
				};
				var callback = function(responseObj) {
					//var outputResult = responseObj.data.result;
					
					var success = responseObj.IsSuccess;
					if (!success) {
						log.error("错误信息：" + result.msg);
						throw new Error("数据比较执行异常！");

					} else {
						finalResultsValue = responseObj.CompareResults;
						finalResults = jsonUtil.json2obj(finalResultsValue);
						if (isSave) {
							if (isClearSaveData)
//								viewModel.getDataModule().removeAllRecordsByDS(saveDataSource);
								pusher.removeAllRecords({"datasourceName":saveDataSource});
							// 获取构造的存储实体数据
							if (finalResults != null && finalResults.length > 0) {
								var newSaveRecords = getCopyRecordsByMapping(saveDataSource, finalResults, mappings);
//								viewModel.getDataModule().insertByDS(saveDataSource, newSaveRecords);
								var datasource = manager.lookup({"datasourceName":saveDataSource});
								datasource.insertRecords({"records":newSaveRecords});
							}
						}
						if (finalResults != null
								&& finalResults.length == srcRecords.length)
							bussinessReturnValue = true;
						else
							bussinessReturnValue = false;

						setBusinessRuleResult(ruleContext, bussinessReturnValue);

					}

					return true;
				};

//				operationLib.executeRuleSet(inputParams, callback);
				 var sConfig = {
						"isAsyn": false,
						"componentCode": scope.getComponentCode(),
						"transactionId": ruleContext.getRouteContext().getTransactionId(),
						ruleSetCode: "CommonRule_CompareEntityAndTableData",
						commitParams: [{
							"paramName": "InParams",
							"paramType": "char",
							"paramValue": inputParams.params.InParams
							}],
						afterResponse: callback
				 }
		
				 var scopeId = scope.getInstanceId();
					var windowScope = scopeManager.getWindowScope();
					if (scopeManager.isWindowScope(scopeId)) {
						sConfig.windowCode = windowScope.getWindowCode();
					}
				//  调用后台活动集
				//operationLib.executeRuleSet(inputParams, callback);
				remoteMethodAccessor.invoke(sConfig);
				 
				return true;
			};
	
	function setBusinessRuleResult(ruleContext, result){
		if(ruleContext.setBusinessRuleResult){
					ruleContext.setBusinessRuleResult({
						isMatchCompare : result
					});
		}
	}
	
	var validSaveMapping=function(isSave,mappings){
		if(!isSave)
			return;
		if(mappings==null || mappings.length==0)
		{
		   throw new Error("比较结果存储映射不能为空");
		}
		for(var i=0;i<mappings.length;i++){
		       if(mappings[i].saveField==null || mappings[i].saveField=="")
		       {
		           throw new Error("比较结果存储字段不能为空");
		       }
		       if(mappings[i].resultField==null || mappings[i].resultField=="")
		       {
		           throw new Error("比较结果源或目标表及查询字段不能为空");
		       }
		}
	};
	
	var cloneObj=function(obj){
		var clone={};
		for(prop in obj){
		   clone[prop]=obj[prop];
		}
		return clone;
	};
	
	var getFieldName=function(fieldName){
		if(fieldName!=null && fieldName.indexOf(".")>0)
			return fieldName.split(".")[1];
		return fieldName;
	};
	
	var getCopyRecordsByMapping=function(dataSource,records,mappingFields){
//		var emptyRecord=viewModel.getDataModule().createEmptyRecordByDS(dataSource);
		var datasource = manager.lookup({"datasourceName":dataSource});
		var emptyRecord = datasource.createRecord();
		
		var copyRecords=[];
		for(var i=0;i<records.length;i++){
		    //var obj=emptyRecord.createNew();
		    var tempRecord = emptyRecord.clone();
		    if(tempRecord.getMetadata().isContainField("id")) {
		    	tempRecord.set("id",uuid.generate());
			}
		    var obj = tempRecord;

		    for(var j=0;j<mappingFields.length;j++){
		        var resultFieldVal=records[i][mappingFields[j].resultField];
		        if(resultFieldVal==null)
				{
				   resultFieldVal = records[i][getFieldName(mappingFields[j].resultField) ];
				}
		        obj.set(getFieldName(mappingFields[j].saveField),resultFieldVal);
		    }
		    copyRecords.push(obj);
		}
		return copyRecords;
	};
	
	var getFieldByDataSource=function(dataSource,fieldName){
//	      var fields=viewModel.getMetaModule().getMetadataFieldsByDS(dataSource);
		  var datasource = manager.lookup({"datasourceName":dataSource});
		  var metadata = datasource.getMetadata();
		  var fields = metadata.getFields();
		  
	      var field=null;
	      if(fields!=null){
	          for(var i=0;i<fields.length;i++){
	          	  var metaFieldName=fields[i].field;
	          	  if(metaFieldName==null)
	          	      metaFieldName=fields[i].code;
	          	 
	          	  var b=fieldName.split(".");
	              if(metaFieldName==fieldName)
	              {
	                 field= fields[i];
	              }
	              if(b.length==2 && metaFieldName==b[1])
	              {
	                 field=fields[i];
	              }
	          }
	      }
	      return field;
	};
	
	
	/**
	 *	根据源实体名称及拷贝类型来获取要拷贝的行数据
	 *  @param	dataSource	源实体名称
	 *  @param	condition		    源实体条件
	 */
	var getFilterRecords = function(dataSource,  condition, ruleContext) {
		var outputRecords = [];
//		var records = viewModel.getDataModule().getAllRecordsByDS(dataSource);
		var datasource = manager.lookup({"datasourceName":dataSource});
		var records = datasource.getAllRecords().toArray();
		
		if(condition==null || condition==""){
			var resultData = [];
			if (records && records.length > 0) {
				for (var i = 0; i < records.length; i++) {
					var record = records[i];
					resultData.push(record.toMap());
				}
			}
//			return viewModel.getDataModule().genDataMaps(records);
			return resultData;
		}
		
		if(records && records.length > 0) {
				var retRecords = [];
				for(var index = 0; index < records.length; index++) {
					var record = records[index];
					//var ret = formulaUtil.evalExpressionByRecords(condition, record);
					var context = new ExpressionContext();
					context.setRouteContext(ruleContext.getRouteContext());
					context.setRecords([record]);
					var ret = engine.execute({"expression":condition,"context":context});
					if( typeof ret != "boolean") {
						log.error("条件必须返回布尔类型，请检查");
						continue;
					}
					if(ret == true) {
						outputRecords.push(record.toMap());
					}
				}
		}
		return outputRecords;
	};
	
	exports.main = main;

export{    main}