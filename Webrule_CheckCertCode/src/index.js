
	var viewModel;
	var jsonUtil;
	var operationLib;
	var uuid;
	var accessor;
	var scopeManager;
	var ExpressionContext;
	var engine;
	var widgetAction;
	var factory;
	var environment;
	var frontAlert;
	var rpc;
	var i18n;

	exports.initModule = function(sBox) {
		jsonUtil = sBox.getService("vjs.framework.extension.util.JsonUtil");
		uuid = sBox.getService("vjs.framework.extension.util.UUID");
		remoteMethodAccessor = sBox.getService("vjs.framework.extension.platform.services.operation.remote.RemoteMethodAccessor");
		scopeManager = sBox.getService("vjs.framework.extension.platform.interface.scope.ScopeManager");
		expressionContext = sBox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionContext");
		engine = sBox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionEngine");
		widgetAction = sBox.getService("vjs.framework.extension.platform.services.view.widget.common.action.WidgetAction");
		environment = sBox.getService("vjs.framework.extension.platform.interface.environment.Environment");
		factory = sBox.getService("vjs.framework.extension.platform.interface.exception.ExceptionFactory");
		frontAlert = sBox.getService("vjs.framework.extension.platform.interface.alerter.FrontEndAlerter");
		rpc = sBox.getService("vjs.framework.extension.system.RPC");
		i18n = sBox.getService("vjs.framework.extension.platform.interface.i18n.platform");
	}
	/**
	 * 获取文件标识数据
	 * */
	function getCookie(name) { 
	    var arr,reg=new RegExp("(^| )"+name+"=([^;]*)(;|$)");
	    if(arr=document.cookie.match(reg))
	        return unescape(arr[2]); 
	    else 
	        return null;
	} 

	var main = function(ruleContext) {
		var ruleCfgValue = ruleContext.getRuleCfg();
		var inParams = ruleCfgValue["inParams"];
		var inParamsObj = jsonUtil.json2obj(inParams);
		//图片组件ID
		var widgetId = inParamsObj["picId"];
		//生成目标：imageControl(图片控件), fileID（文件标识）
		var buildTargetType = "fileID" == inParamsObj["buildTargetType"] ? "fileID" : "imageControl";
		var fileIDReceiveTargetType = inParamsObj["fileIDReceiveTargetType"] ? inParamsObj["fileIDReceiveTargetType"] : null;
		var valueTarget = inParamsObj["fileIDReceiveTarget"];
		//是否重置
		var isReset = inParamsObj["isReset"];
		//输入的验证码
		var context = new expressionContext();
		context.setRouteContext(ruleContext.getRouteContext());
		var inputCode = engine.execute({
			"expression": inParamsObj["inputCode"],
			"context": context
		});

		var iden = getCookie("v_platform_make_code_iden");
		
		inParamsObj.inputCode = inputCode;
		//文件标识
		inParamsObj.fileId = iden;

		if (undefined == inputCode || null == inputCode || undefined == widgetId || null == widgetId) {
			if("fileID" != buildTargetType){//
				//设置返回值
				setBusinessRuleResult(ruleContext, false);
				return;
			}
		}

		var outFlag = false;
		var callback = function(responseObj) {
			var success = responseObj.IsSuccess;
			if (!success) {
				HandleException(ruleContext,"session过期或生成的验证码为空，请重新生成验证码.");
//				throw new Error("校验验证码异常！");
			}

			outFlag = responseObj.OutFlag;
			if (!outFlag) {
				//如果选中重置调用重新生成验证码
				if (isReset) {
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
										msg:i18n.get("生成验证码失败，错误信息：","获取随机验证码时报错错误信息") + (datas.msg ? datas.msg : ""),
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
						var url = environment.getContextPath() + 'module-operation!executeOperation?moduleId=' + moduleId + '&operation=FileCertImage&xx=' + iden;
						widgetAction.executeWidgetAction(widgetId, 'setImageUrl', url);
					}
				}
			}
			//设置返回值
			setBusinessRuleResult(ruleContext, outFlag);
		};
		/**
		 * desc 异常处理方法
		 * @ruleContext 规则上下文
		 * @error_msg 提示信息
		 * vjs: 可省略
		 * services: 
		 * 		factory = sandbox.getService("vjs.framework.extension.platform.interface.exception.ExceptionFactory");
		 * */
		function HandleException(ruleContext,error_msg){
			var exception = factory.create({"type":factory.TYPES.Business, "message":error_msg});
			ruleContext.handleException(exception);
			throw exception;
		}
		var scope = scopeManager.getWindowScope();
		var windowCode = scope.getWindowCode();
		var componentCode = scope.getComponentCode();
		var routeContext = ruleContext.getRouteContext();
		var sConfig = {
			"isAsyn": false,
			"componentCode": componentCode,
			"windowCode": windowCode,
			"transactionId": routeContext.getTransactionId(),
			ruleSetCode: "CommonRule_CheckCertCode",
			commitParams: [{
				"paramName": "InParams",
				"paramType": "char",
				"paramValue": jsonUtil.obj2json(inParamsObj)
			}],
			afterResponse: callback
		}
		remoteMethodAccessor.invoke(sConfig);

		/**
		 * 设置业务返回结果
		 */
		function setBusinessRuleResult(ruleContext, result) {
			if (ruleContext.setBusinessRuleResult) {
				ruleContext.setBusinessRuleResult({
					isValidateOK: result
				});
			}
		}

	};

	exports.main = main;

export{    main}