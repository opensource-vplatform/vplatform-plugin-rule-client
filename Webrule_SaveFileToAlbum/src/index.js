/**
 *
 *
 */

		var logUtil,ERRORNAME,factory,saveImageToGalleryService,remoteMethodAccessor,scopeManager,operation;
		//初始化vjs模块，如果规则逻辑需要引用相关vjs服务，则初始化相关vjs模块；如果不需要初始化逻辑可以为空
		exports.initModule = function(sBox){
			//sBox：前台vjs的沙箱（容器/上下文），可以用它根据vjs名称，获取到相应vjs服务
			sandbox = sBox;
			logUtil = sandbox.getService("vjs.framework.extension.util.log");
			factory = sandbox.getService("vjs.framework.extension.platform.interface.exception.ExceptionFactory");
			jsonUtil = sandbox.getService("vjs.framework.extension.util.JsonUtil");
			ExpressionContext = sandbox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionContext");
			engine = sandbox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionEngine");
			scopeManager = sandbox.getService("vjs.framework.extension.platform.interface.scope.ScopeManager");
			remoteMethodAccessor = sandbox.getService("vjs.framework.extension.platform.services.operation.remote.RemoteMethodAccessor");
			saveImageToGalleryService = sandbox.getService("vjs.framework.extension.platform.services.native.mobile.SaveImageToGallery");
			operation = sandbox.getService("vjs.framework.extension.platform.services.domain.operation.RemoteOperation");
		}
		
		//规则主入口(必须有)d
		var main = function (ruleContext) {
			ERRORNAME = "规则[SaveFileByUrl]";
			// 获取规则链路由上下文,终止执行后续规则
			var routeContext = ruleContext.getRouteContext();
			// 获取规则链路由上下文的配置参数值
			var ruleCfgValue = ruleContext.getRuleCfg();
			// 获取开发系统配置的参数
			var inParams = ruleCfgValue["inParams"];
			var inParamsObj = convertJson(inParams);
			var type = inParamsObj.sourceType;
			var value = inParamsObj.sourceValue ? experssFunc(inParamsObj.sourceValue,routeContext) : HandleException("文件标识或url不存在，请检查配置");
			if(type == "url"){
				var fileUrl = value;
				var fileName = getFileName(fileUrl);
				fileName = fileName.replace(/\s+/g,"");
				if(window.device.platform == "iOS") {
					fileName = new Date().getTime() +"."+ getFileNameLast(fileName);
				}
				saveFile(fileUrl,fileName,ruleContext);
			}else{
				var fileId = value;
				var getFileInfoCB = function(fileName){
					fileName = fileName.replace(/\s+/g,"");
					if(window.device.platform == "iOS") {
						fileName = new Date().getTime() +"."+ getFileNameLast(fileName);
					}
					var getFileUrlByFileIdExp = "GetFileUrlByFileId(\"" + fileId + "\")";
					var getFileUrlCB = function(url){
						saveFile(url,fileName,ruleContext);
					}
					executeExpression(getFileUrlByFileIdExp,getFileUrlCB);
				};
				var getFileInfoExp = "GetFileInfo(\"" + fileId + "\",\"fileName\")";
				executeExpression(getFileInfoExp,getFileInfoCB);
			}
			SuspendRuleChain(ruleContext);
		};
		
		var saveFile = function(fileUrl,fileName,ruleContext){
			var successCB = function(results) {
				ruleContext.fireRouteCallback();
		    };
			var failCB = function (error) {
				HandleException("保存失败！");
		        ruleContext.fireRouteCallback();
		    };
		    var options = {
		    	fileUrl:fileUrl,
		    	fileName:fileName
		    };
		    saveImageToGalleryService.saveimagetogallery(successCB,failCB,options);
		}
		
		/**
		 * 执行后台函数（根据文件ID获取文件信息）
		 */
		var executeExpression = function(expression,callback) {
			var scope = scopeManager.getWindowScope(), windowCode = null;
			if(scope != null){
				windowCode = scope.getWindowCode();
			}
			var paramData = {"expression": expression};
			var result = null;
			operation.request({
				"windowCode": windowCode,
				"operation": "WebExecuteFormulaExpression",
				"isAsync": false,
				"params": paramData,
				"success": function(rs) {
					result = rs.data.result;
					callback(result);
				},
				"error": function(e) {
					HandleException(e);
				}
			});
		}
		
		/**
		 * desc 执行表达式
		 * experss 表达式
		 * routeContext 路由上下文
		 */
		var experssFunc = function(experss,routeContext){
			if(experss==null || experss==""){
				return null;
			}
			var context = new ExpressionContext();
			context.setRouteContext(routeContext);
			if(undefined == experss || null == experss) return null;
			var resultValue = engine.execute({
				"expression": experss,
				"context": context
			});
			return resultValue;
		}
		
		/**
		 * desc Json字符串转Json对象
		 * inParams 
		 * vjs:
		 * 		"vjs.framework.extension.util.json":null,
		 * services:
		 * 		jsonUtil = sandbox.getService("vjs.framework.extension.util.JsonUtil");
		 * */
		var convertJson = function(inParams){
			var result = {};
			if(undefined != inParams){
				result = jsonUtil.json2obj(inParams);
			}
			return result;
		}
		
		/**
		 * desc 异常处理方法
		 * error_msg 提示信息
		 */
		function HandleException(error_msg){
			error_msg = ERRORNAME+error_msg;
			var exception = factory.create({"type":factory.TYPES.Dialog, "message":error_msg});
	    	throw exception;
		}
		
		/**
		 * 获取URL后缀
		 */
		function getFileName(fileName) {
			return fileName.split("/").pop();
	    }
		
		/**
		 * 获取文件名后缀
		 */
		function getFileNameLast(fileName) {
			return fileName.split(".").pop();
	    }
		
		/**
		 * desc 打印日志
		 * content 需要打印的内容
		 * type 打印的类型，log、warn、error
		 */
		function OutPutLog(content,type){
			if(log==null) return;
			/*打印log类型的日志*/
			if(type=="log"){
				log.log(ERRORNAME+content);
				return;
			}
			/*打印warn类型的日志*/
			if(type=="warn"){
				log.warn(ERRORNAME+content);
				return;
			}
			/*打印error类型的日志*/
			if(type=="error"){
				log.error(ERRORNAME+content);
				return;
			}
		}
		
		/**
		 * 中断规则链
		 */
		function SuspendRuleChain(ruleContext){
			ruleContext.markRouteExecuteUnAuto();
		}
		
		/**
		 * 释放规则链
		 */
		function ReleaseRuleChain(ruleContext){
			ruleContext.fireRouteCallback();
		}
		//注册规则主入口方法(必须有)
		exports.main = main;
	
export{    main}