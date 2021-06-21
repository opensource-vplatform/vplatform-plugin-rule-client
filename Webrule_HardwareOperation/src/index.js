/**
 *
 *
 */

	
		var hardwareOperationService ,jsonUtil , log , ExpressionContext ,engine;
	
		//初始化vjs模块，如果规则逻辑需要引用相关vjs服务，则初始化相关vjs模块；如果不需要初始化逻辑可以为空
		exports.initModule = function(sBox){
			//sBox：前台vjs的沙箱（容器/上下文），可以用它根据vjs名称，获取到相应vjs服务
			hardwareOperationService = sBox.getService("vjs.framework.extension.platform.services.native.mobile.HardwareOperation");
			jsonUtil = sBox.getService("vjs.framework.extension.util.JsonUtil");
			log = sBox.getService("vjs.framework.extension.util.log");
			ExpressionContext = sBox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionContext");
			engine = sBox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionEngine");
			
		}
		
		//规则主入口(必须有)
		var main = function (ruleContext) {
			var routeContext = ruleContext.getRouteContext() ;
			var ruleCfgValue = ruleContext.getRuleCfg() ;
			var inParamObj = jsonUtil.json2obj( ruleCfgValue["inParams" ] ) ;
			
			
			if(inParamObj.operationType == "flashOn" ){
				hardwareOperationService.openFlashLight() ;
				
			}else if(inParamObj.operationType == "flashOff" ){
				hardwareOperationService.closeFlashLight();
				
			}else if(inParamObj.operationType == "brightness" ){
				var inputParam = inParamObj.inputParams[0] ;
				if(inputParam.paramCode == "lightenessValue" &&
						inputParam.paramType == "expression") {
					var lightnessValue = expressFunc(inputParam.paramValue , routeContext );
					hardwareOperationService.setScreenBrightness(lightnessValue);
				}else{
					//TODO 抛出“无效参数”异常
					log.error("无效参数");
				}
				
			}else if(inParamObj.operationType == "getGPSOpenstate" ){
				var success = function(s){
					if(s == 0 ){
						setBusinessRuleResult(ruleContext , inParamObj.returnResult , false );
					}else if(s == 1){
						setBusinessRuleResult(ruleContext , inParamObj.returnResult , true  );
					}
					ruleContext.fireRouteCallback();
				}
				var error = function(message) {
					//TODO 异常处理
					log.error("执行getGPSStatus发生错误。"+message);
					ruleContext.fireRouteCallback();
				}
				hardwareOperationService.getGPSStatus( success , error );

				ruleContext.markRouteExecuteUnAuto();
				
			}else if(inParamObj.operationType == "getBluetoothOpenstate" ){
				ruleContext.markRouteExecuteUnAuto();
				var success = function(s){
					setBusinessRuleResult(ruleContext , inParamObj.returnResult , s );
					ruleContext.fireRouteCallback();
				}
				var error = function(message) {
					//TODO 异常处理
					log.error("执行getBluetoothStatus发生错误。" + message);
					ruleContext.fireRouteCallback();
				}
				hardwareOperationService.getBluetoothStatus( success , error );
			}else if(inParamObj.operationType == "getCurrentNetworkstatus" ){
				var success = function(s){
					setBusinessRuleResult(ruleContext , inParamObj.returnResult , s );
					ruleContext.fireRouteCallback();
				}
				var error = function(message) {
					//TODO 异常处理
					log.error("执行getNetworkState发生错误。" + message);
					ruleContext.fireRouteCallback();
				}
				hardwareOperationService.getNetworkState( success , error );
				ruleContext.markRouteExecuteUnAuto();
			}else if(inParamObj.operationType == "setShock" ){
				var inputParam = inParamObj.inputParams[0] ;
				if(inputParam.paramCode == "shockSeconds" &&
						inputParam.paramType == "expression") {
					var shockSeconds = expressFunc(inputParam.paramValue , routeContext );
					hardwareOperationService.vibrate(shockSeconds * 1000 ) ;
				}else{
					//TODO 抛出“无效参数”异常
					log.error("无效参数");
				}
			}else{
				//TODO 抛出 "无效操作"异常
				log.error("无效操作类型。" + inParamObj.operationType );
			} 
			
		};
		
		function expressFunc(experss,routeContext){
			if(experss==null || experss==""){
				return null;
			}
			var context = new ExpressionContext();
			context.setRouteContext(routeContext);
			var resultValue = engine.execute({
				"expression": experss,
				"context": context
			});
			return resultValue;
		}
		
		function setBusinessRuleResult(ruleContext , returnResult , resultValue ) {
			for( var i = 0 ; i < returnResult.length ; i++ ){
				var resultType = returnResult[i].resultType ;
				var resultName = returnResult[i].resultValue ;
				if(resultType == "ruleSetVar" ){
					ruleContext.getRouteContext().setVariable(resultName, resultValue);
				}else if(resultType == "ruleSetOutput" ){
					ruleContext.getRouteContext().setOutputParam(resultName, resultValue);
				}else{
					//TODO 警告“无效返回类型”
					log.warn("无效的返回类型："+ resultType );
				}
			}
		}
		
		//注册规则主入口方法(必须有)
		exports.main = main;
	
export{    main}