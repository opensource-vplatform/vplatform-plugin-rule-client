
	var jsonUtil;
	var uuid;
	var scopeManager;
	var widgetAction;
	var environment;
	var frontAlert;
	var rpc;

	exports.initModule = function(sBox) {
		sb = sBox;
		jsonUtil = sBox.getService("vjs.framework.extension.util.JsonUtil");
		uuid = sBox.getService("vjs.framework.extension.util.UUID");
		scopeManager = sBox.getService("vjs.framework.extension.platform.interface.scope.ScopeManager");
		widgetAction = sBox.getService("vjs.framework.extension.platform.services.view.widget.common.action.WidgetAction");
		environment = sBox.getService("vjs.framework.extension.platform.interface.environment.Environment");
		frontAlert = sb.getService("vjs.framework.extension.platform.interface.alerter.FrontEndAlerter");
		rpc = sb.getService("vjs.framework.extension.system.RPC");
		i18n = sb.getService("vjs.framework.extension.platform.interface.i18n.platform");
	}

	var main = function(ruleContext) {
		var ruleCfgValue = ruleContext.getRuleCfg();
		var inParams = ruleCfgValue["inParams"];
		var inParamsObj = jsonUtil.json2obj(inParams);
		var widgetId = inParamsObj["picCode"];
		var buildTargetType = "fileID" == inParamsObj["buildTargetType"] ? "fileID" : "imageControl";
		var fileIDReceiveTargetType = inParamsObj["fileIDReceiveTargetType"] ? inParamsObj["fileIDReceiveTargetType"] : null;
		var valueTarget = inParamsObj["fileIDReceiveTarget"];
		var scope = scopeManager.getWindowScope();
		var moduleId = scope.getWindowCode();
		var iden = uuid.generate();
		document.cookie = "v_platform_make_code_iden="+iden;
		if("fileID" == buildTargetType){
			var scope = scopeManager.getWindowScope();
			var componentCode = scope.getComponentCode();
			var windowCode = scope.getWindowCode();
			var str = jsonUtil.obj2json({
				iden : iden,
				target : buildTargetType
			});
			var infos = {
				paramName : "InParams",
				paramType : "string",
				paramValue : ""
			}
			var success = function(datas){
				switch(fileIDReceiveTargetType){
				case "ruleSetInput":
					ruleContext.getRouteContext().setInputParam(valueTarget, iden);
					break;
				case "ruleSetVar":
					ruleContext.getRouteContext().setVariable(valueTarget, iden);
					break;
				case "ruleSetOutput":
					ruleContext.getRouteContext().setOutputParam(valueTarget, iden);
					break;
				}
				ruleContext.fireRouteCallback();
			}
			rpc.invokeOperation({
				"componentCode":componentCode,
				"windowCode":windowCode,
				"CertPicCode":iden,
				"operationName":"FileCertImage",
				"isAsync":false,
				"afterResponse":function(datas){
					if(datas.success){
						success();
					}else{
						frontAlert.error({
							title:i18n.get("请求数据错误","获取随机验证码时报错弹框的标题"),
							msgHeader: i18n.get("生成验证码失败","获取随机验证码时报错的错误信息标题"),
							msg:i18n.get("生成验证码失败，错误信息：","获取随机验证码时报错错误信息") + (returnJson.msg ? returnJson.msg : ""),
							detail:i18n.get("暂无","获取随机验证码时报错的详细错误信息"),
							callback:function(){
								ruleContext.fireRouteCallback();
							}
						});
					}
				}
			});
		}else{
			//xx参数防止图片组件接受相同地址时不刷新问题
			var url = environment.getContextPath() + 'module-operation!executeOperation?moduleId=' + moduleId + '&operation=FileCertImage&xx=' + uuid.generate();
			widgetAction.executeWidgetAction(widgetId, 'setImageUrl', url);
		}
	};

	exports.main = main;

export{    main}