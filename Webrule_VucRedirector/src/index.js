/**
 *
 *
 */

		var sandBox,ExpressionContext,formulaEngine,browser,jsonUtil,uuid;
		//初始化vjs模块，如果规则逻辑需要引用相关vjs服务，则初始化相关vjs模块；如果不需要初始化逻辑可以为空
		exports.initModule = function(sBox){
			//sBox：前台vjs的沙箱（容器/上下文），可以用它根据vjs名称，获取到相应vjs服务
			sandBox = sBox;
			jsonUtil = sandBox.getService("vjs.framework.extension.util.JsonUtil");
			ExpressionContext = sandBox.getService("vjs.framework.extension.platform.engine.expression.ExpressionContext");
			formulaEngine = sandBox.getService("vjs.framework.extension.platform.engine.expression.ExpressionEngine");
			browser = sandBox.getService("vjs.framework.extension.platform.services.browser.Browser");
			uuid = sandBox.getService("vjs.framework.extension.util.UUID");
		}
		
		//规则主入口(必须有)
		var main = function (ruleContext) {
			// 获取规则链路由上下文,终止执行后续规则
			var routeContext = ruleContext.getRouteContext();
			// 获取规则链路由上下文的配置参数值
			var ruleCfgValue = ruleContext.getRuleCfg();
			// 获取开发系统配置的参数
			var inParams = ruleCfgValue["inParams"];
			var inParamObjs = jsonUtil.json2obj(inParams);
			
			var url = parseUrl(inParamObjs.url,ruleContext);
			var redirectOrigin = new RegExp("^https?://[\\w-.]+(:\\d+)?").exec(url)[0];
			var locationOrigin = location.origin;
			
			if(redirectOrigin != locationOrigin || url.indexOf("errorMsg") != -1){
				//不同域名或异常情况，直接将地址设置到地址栏打开
				location.href = url;
			}else{
				//同域名
				var redirectUrl = url.split("redirect_uri=")[1];
				if(redirectUrl){
					var decodeRedirectUrl = redirectUrl,
						componentCode = "",
						windowCode = "";
					
					while(decodeRedirectUrl.indexOf("%25") != -1 || decodeRedirectUrl.indexOf("%3A") != -1){
						decodeRedirectUrl = decodeURIComponent(decodeRedirectUrl);
					}
					var urlParams = getUrlParams(decodeRedirectUrl);
					
					if(urlParams["componentCode"]){
						componentCode = urlParams["componentCode"];
					}
					if(urlParams["windowCode"]){
						windowCode = urlParams["windowCode"];
					}
					
					var windowCodeIndex = redirectUrl.indexOf(windowCode);
					redirectUrl = redirectUrl.substring(windowCodeIndex + windowCode.length, "");
					
					var iframe = document.createElement("iframe");
					var staticPagePath = locationOrigin + "/redirect.html";
					iframe.id = uuid.generate();
					iframe.src = url.replace(redirectUrl,staticPagePath);
					iframe.style.position = "absolute"; 
					iframe.style.top = "-9999px";
					var interval = setInterval(function(){
						if(iframe.contentWindow){
							var href = iframe.contentWindow.location.href;
							if(href.indexOf("errorMsg") != -1){
								clearInterval(interval);
								location.href = url;
							}
						}
					},500)
					createOpenWindowCallback(componentCode,windowCode,routeContext,interval);
					document.body.appendChild(iframe);
				}
			}
			
		};
		
		var parseUrl = function(url,ruleContext){
			var context = new ExpressionContext();
			context.setRouteContext(ruleContext.getRouteContext());
			url = formulaEngine.execute({
				"expression": url,
				"context": context
			});
			return url;
		}
		
		var getUrlParams = function(url){
			var params = {};
			var paramsStr = url.split("?")[1];
			if(paramsStr){
				var paramInfo = paramsStr.split("&");
				for(var i = 0 ; i < paramInfo.length; i ++){
					var result = paramInfo[i].split("=");
					params[result[0]] = result[1];
				}
			}
			return params;
		}
		
		var createOpenWindowCallback = function(componentCode,windowCode,routeContext,interval){
			window.openWindow = function(){
				if(interval){
					clearInterval(interval);
				}
				var windowInputParams = {
					variable:{
						formulaOpenMode:"locationHref"
					}
				}
				browser.redirectModule({
					"componentCode": componentCode,
					"windowCode": windowCode,
					"params": {
						inputParam: windowInputParams
					}
				});
			}
		}
		
		//注册规则主入口方法(必须有)
		exports.main = main;
		
		
	
export{    main}