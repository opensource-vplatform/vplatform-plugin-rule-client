/**
 * 多语言操作
 */


	var jsonUtil, scopeManager, remoteServer;
	var sandbox;
	var i18n;
	//cookie里i18n标识
	var VPLATFORMI18NIDEN = "langCookie";
	var frontAlert,logUtil,ProgressBarUtil,ExpressionContext,formulaUtil;

	exports.initModule = function(sb) {
		sandbox = sb;
		jsonUtil = sb.getService("vjs.framework.extension.util.JsonUtil");
		remoteServer = sb.getService("vjs.framework.extension.platform.services.operation.remote.RemoteMethodAccessor");
		scopeManager = sb.getService("vjs.framework.extension.platform.interface.scope.ScopeManager");
		widgetProperty = sb.getService("vjs.framework.extension.platform.services.view.widget.common.action.WidgetProperty");
		windowParam = sb.getService("vjs.framework.extension.platform.services.param.manager.WindowParam");
		componentParam = sb.getService("vjs.framework.extension.platform.services.param.manager.ComponentParam");
		dbService = sb.getService("vjs.framework.extension.platform.services.view.logic.datasource.DatasourceUtil");
		dsFactory = sb.getService("vjs.framework.extension.platform.interface.model.datasource.DatasourceFactory");
		i18n = sb.getService("vjs.framework.extension.platform.interface.i18n.platform");
		frontAlert = sb.getService("vjs.framework.extension.platform.interface.alerter.FrontEndAlerter");
		logUtil = sb.getService("vjs.framework.extension.util.log");
		formulaUtil = sb.getService("vjs.framework.extension.platform.engine.expression.ExpressionEngine");
		ProgressBarUtil = sb.getService("vjs.framework.extension.platform.services.view.widget.common.progressbar.ProgressBarUtil");
		ExpressionContext = sb.getService("vjs.framework.extension.platform.engine.expression.ExpressionContext");
	}

	/**
	 * 调用command
	 * @param	{Object}	params	提交的参数
	 * @param	{Function}	success	成功的回调
	 * @param	{Function}	error	失败的回调
	 * */
	var InvokeCommand = function(params,success,error){
		var scope = scopeManager.getWindowScope();
		var sConfig = {
				"isAsyn": false,
				"componentCode": scope.getComponentCode(),
				"windowCode": scope.getWindowCode(),
				ruleSetCode: "I18nOperation",
				isRuleSetCode:false,
				commitParams: [params],
				error:error,
				afterResponse: success
		}
		remoteServer.invoke(sConfig);
	}
	
	/**
	 * 获取语言值
	 * */
	function getLanguage(){
		var arr,reg=new RegExp("(^| )"+VPLATFORMI18NIDEN+"=([^;]*)(;|$)");
		if(arr=document.cookie.match(reg))
			return unescape(arr[2]);
		else
			return null;
	}
	
	/**
	 * 把当前语言设置到localStorage
	 * */
	function setLanguage(value){
//		document.cookie = VPLATFORMI18NIDEN + "=" + value;
		localStorage.setItem(VPLATFORMI18NIDEN,value);
		VMetrix.putAllVjsContext({
			language:value
		},1);
		window.location.reload();
	}
	
	var main = function(ruleContext) {
		var ruleCfgValue = ruleContext.getRuleCfg(),
			inParams = ruleCfgValue["inParams"];

		if (inParams && "" != inParams) {
			var inParamObj = jsonUtil.json2obj(inParams),
				languageOperation = inParamObj.languageOperation,
				lang = inParamObj.language,
				languageType = inParamObj.languageType,
				returnMapping = inParamObj.returnMapping;

			var scope = scopeManager.getWindowScope();
			var componentCode = scope.getComponentCode();
			var windowScope = scope.getWindowCode();

			switch(languageOperation){
				case "getCurLanguage":
					var value = localStorage.getItem(VPLATFORMI18NIDEN);
					_setDataToObject(returnMapping, value, ruleContext);
//					var arr,reg=new RegExp("(^| )"+VPLATFORMI18NIDEN+"=([^;]*)(;|$)");
//					if(arr = document.cookie.match(reg)){
//						value = unescape(arr[2]);
//					}else{
//						logUtil.info("当前cookie没有保存语言.");
//					}
					break;
				case "getLanguages":
					var params = {};
					params["paramName"] = "InParams";
					params["paramType"] = "object";
					params["paramValue"] = {
						operation : "getAll",
					};
					var success = scopeManager.createScopeHandler({
						handler : function(returnJson){
							if(returnJson && returnJson.data && returnJson.data.types){
								var types = returnJson.data.types;
								_setDataToObject(returnMapping, types, ruleContext)
							}
							ProgressBarUtil.hideProgress(true);
							ruleContext.fireRouteCallback();
						}
					});
					var error = function(returnJson){
						ProgressBarUtil.hideProgress(true);
						frontAlert.error({
							title:i18n.get("后台处理异常","获取全部语种时，后台报错的弹框标题"),
							msgHeader: i18n.get("获取多语言信息异常","获取全部语种时，后台报错的错误信息标题"),
							msg:i18n.get("无法获取语种列表. 错误信息：","获取全部语种时，后台返回的错误信息") + (returnJson.msg ? returnJson.msg : ""),
							detail:i18n.get("暂无","获取全部语种时，后台返回的详细错误信息"),
							callback:function(){
								ruleContext.fireRouteCallback();
							}
						});
					}
					ProgressBarUtil.showProgress(i18n.get("正在获取语言列表","获取语言列表时进度条的提示文字"), true);
					InvokeCommand(params,success,error);
					ruleContext.markRouteExecuteUnAuto();
					break;
				case "setCurLanguage":
					var context = new ExpressionContext();
					context.setRouteContext(ruleContext.getRouteContext());
					var value = formulaUtil.execute({
						"expression": inParamObj.language,
						"context": context
					});
					if(null != value && "" != value){
						setLanguage(value);
					}else{
						frontAlert.error({
							title:i18n.get("配置异常","无法设置语言的弹框标题"),
							msgHeader: i18n.get("设置语言异常","无法设置语言的错误信息标题"),
							msg:i18n.get("无法设置语言. 错误信息：语言编码为空","无法设置语言的错误信息")
						});
					}
					break;
			}
		}
	}
	/*执行表达式*/
    var experssFunc = function(experss, routeContext) {
        var context = new ExpressionContext();
        context.setRouteContext(routeContext);
        if (undefined == experss || null == experss) return null;
        var resultValue = engine.execute({
            "expression": experss,
            "context": context
        });
        return resultValue;
    }

	// 创建游离 DB 对象信息
	var _createDBInfo = function(types) {
		var len = 0;
		var objs = [];
		var len = types.length;
		for(var i = 0; i < len; i++){
			var type = types[i];
			var map = {};
			map.id = i;
			map.code = type.code;
			map.name = type.name;
			map.icon = type.icon;
			objs.push(map);
		}
		var result = new Object,
			metadata = new Object,
			model = new Object;

		var datas = {
			"recordCount": len,
			"values": objs
		};
		result.datas = datas;

		var fields = [{
			"code": "id",
			"name": "id",
			"length": 255,
			"type": "char",
			"defaultValue": "",
			"precision": ""
		}, {
			"code": "code",
			"name": "code",
			"length": 255,
			"type": "char",
			"defaultValue": "",
			"precision": ""
		}, {
			"code": "name",
			"name": "name",
			"length": 255,
			"type": "char",
			"defaultValue": "",
			"precision": ""
		},{
			"code": "icon",
			"name": "icon",
			"length": 255,
			"type": "char",
			"defaultValue": "",
			"precision": ""
		}];

		model.datasourceName = "FreeLangListTb";
		model.fields = fields;
		metadata.model = [model];
		result.metadata = metadata;

		return result;
	};

	var _setDataToObject = function(returnMapping, value, ruleContext) {
		if (returnMapping && returnMapping.length > 0) {
			for (var i = 0; i < returnMapping.length; i++) {
				var mapping = returnMapping[i],
					dest = mapping["dest"];

				var destType = mapping["destType"], //目标类型（entity：实体，control：控件，windowVariant：窗体变量，systemVariant：系统变量）
					src = mapping["src"], //来源(returnValue:返回值，expression:表达式)
					srcType = mapping["srcType"]; //来源(当目标类型是实体时，返回实体存在此处)

				// 目标对象为实体
				if (dbService.isEntity(dest, destType, ruleContext)) {
					var freeDbInfo = _createDBInfo(value),
						freeDb = dsFactory.unSerialize(freeDbInfo),
						srcRecords = freeDb.getAllRecords().toArray(),
						destFieldMapping = mapping["destFieldMapping"],
						updateDestEntityMethod = mapping["updateDestEntityMethod"],
						isCleanDestEntityData = mapping["isCleanDestEntityData"];

					if (updateDestEntityMethod == null)
						updateDestEntityMethod = "insertOrUpdateBySameId";
					dbService.insertOrUpdateRecords2Entity(dest, destType, srcRecords, destFieldMapping, updateDestEntityMethod, isCleanDestEntityData, ruleContext);
				} else {
					var routeContext = ruleContext.getRouteContext();
					switch (destType) {
						case "control":
							if (dest.indexOf(".") == -1) {
								// 目标不存在.表示为单值控件
//								widgetDatasource.setSingleValue(target, srcVal);
								//兼容一些不是没有绑定数据库的控件，如：检索控件
								widgetProperty.set(dest,"Value",value);
							} else {
								// 目标存在.表示为多值控件
								var widgetId = dest.split(".")[0];
								var propertyCode = dest.split(".")[1];
								widgetProperty.set(widgetId, propertyCode, value);
							}
							break;
						case "windowVariant":
							windowParam.setInput({
								"code": dest,
								"value": value
							});
							break;
						case "systemVariant":
							componentParam.setVariant({
								"code": dest,
								"value": value
							});
							break;
						case "ruleSetVariant":
							routeContext.setVariable(dest, value);
							break;
						case "ruleSetOutput":
							routeContext.setOutputParam(dest, value);
							break;
						case "windowOutput":
							// 给当前窗体输出变量赋值
							windowParam.setOutput({
								"code": dest,
								"value": value
							});
							break;
						default:
							log.error("无效的目标类型：" + destType);
							break;
					}
				}
			}
		}
	};

	/**
	 * 给控件赋值
	 */
    var _setWidgetValue=function(destWidgetId,value){
    	if(destWidgetId!=null && destWidgetId.indexOf(".") != -1){
               var splits = destWidgetId.split(".");
               var widgetId = splits[0];
               var dbFieldName = vmMappingUtil.getRefFieldFromWidgetPropertyCode(destWidgetId);
               var valueObj = {};
               valueObj[dbFieldName] = value;
               viewModel.getDataModule().setSingleRecordMultiValue(widgetId, valueObj);
       }else{
              viewModel.getDataModule().setSingleValue(destWidgetId, value);
       }
    };

	exports.main = main;

export{    main}