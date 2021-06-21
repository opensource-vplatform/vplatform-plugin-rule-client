/**
* 打开链接地址,shenxiangz
*
*{
*	"urlType": "0",
*	"url":  "http://www.baidu.com",
*	"targetType": "0",
*	"targetComponentContainerCode": "",
*	"parameters": [{
*		"name": "account",
*		"value": "test"
*	},
*	{
*		"name": "password",
*		"value": "UserTable.password"
*	},
*	{
*		"name": "sex",
*		"value": "systemVarSex"
*	},
*	{
*		"name": "age",
*		"value": "componentVarAge"
*	},
*	]
*}
*
*/

	var log ;
	var jsonUtil;
	var viewContext ;
	var actionHandler ;
	var widgetAction;

	//加载表达式计算模块
//	var formulaUtil ;
	var rendererUtil ;
	var BrowserUtil;
	var scopeManager;	
	var webViewService;
	var uuidUtil;
	var modalByUrlUtil;
	var widgetProperty;
	var eventManager;
	var formulaUtil,
		windowVmManager,
		windowParam,
		componentParam,
		datasourcePusher,
		dbService,
		desUtil,
		indexCloseFuns = {},//首页关闭的函数映射
		datasourceManager,
		dialogUtil;
	
	exports.initModule = function(sandBox){
		 uuidUtil = sandBox.getService("vjs.framework.extension.util.UUID");
		 log = sandBox.getService("vjs.framework.extension.util.log");
		 modalByUrlUtil = sandBox.getService("vjs.framework.extension.platform.services.view.modal.CreateModalByUrl");
		 jsonUtil = sandBox.getService("vjs.framework.extension.util.JsonUtil");
		 ExpressionContext = sandBox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionContext");
		 ExpressEngine = sandBox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionEngine");
		 widgetAction = sandBox.getService("vjs.framework.extension.platform.services.view.widget.common.action.WidgetAction");		 
		 BrowserUtil = sandBox.getService("vjs.framework.extension.platform.services.browser.Browser");
		 widgetProperty = sandBox.getService("vjs.framework.extension.platform.services.view.widget.common.action.WidgetProperty");
//		 viewContext = require('system/view/viewContext');
//		 actionHandler = require("system/widget/actionHandler");
//		 formulaUtil = require("system/util/formulaUtil");
//		 rendererUtil = require("system/util/rendererUtil");
		 webViewService = sandBox.getService("vjs.framework.extension.platform.services.integration.render");
		 scopeManager = sandBox.getService("vjs.framework.extension.platform.interface.scope.ScopeManager");
		 eventManager = sandBox.getService("vjs.framework.extension.platform.interface.event.EventManager");
		 formulaUtil = sandBox.getService("vjs.framework.extension.platform.engine.expression.ExpressionEngine");
		 windowVmManager = sandBox.getService("vjs.framework.extension.platform.services.vmmapping.manager.WindowVMMappingManager");
		 windowParam = sandBox.getService("vjs.framework.extension.platform.services.param.manager.WindowParam");
		 componentParam = sandBox.getService("vjs.framework.extension.platform.services.param.manager.ComponentParam");
		 dbService = sandBox.getService("vjs.framework.extension.platform.services.view.logic.datasource.DatasourceUtil");
		 datasourcePusher = sandBox.getService("vjs.framework.extension.platform.services.domain.datasource.DatasourcePusher");
		 datasourceManager = sandBox.getService("vjs.framework.extension.platform.services.model.manager.datasource.DatasourceManager");
		 desUtil = sandBox.getService("vjs.framework.extension.util.DesUtil");
		 dialogUtil = sandBox.getService("vjs.framework.extension.platform.services.view.widget.common.dialog.DialogUtil");
	}
	//dengb:去掉来源类型的判断逻辑，现在只要一直来源就是表达式
	//值类型(1:实体字段,2:系统变量,3:组件变量,4:常量,5:自定义,6:表达式)
	/*var TYPE_ENTITY_FIELD='1';
	var TYPE_SYSTEM_VARIABLE = '2';
	var TYPE_COMPONENT_VARIABLE = '3';
	var TYPE_CONST = '4';
	var TYPE_CUSTOM = '5';
	var TYPE_EXPRESSION = '6';*/
	
	//目标窗口类型(0:当前页面,1:新窗口,2:当前组件容器,3:父亲组件容器,4:div容器,5:首页页签)
	var TARGET_TYPE_CUR_PAGE=0;
	var TARGET_TYPE_NEW_WINDOW=1;
	var TARGET_TYPE_COMPONENT_CONTAINER=2;
	var TARGET_TYPE_COMPONENT_NEW_TAB=3;
	var TARGET_TYPE_DIV_CONTAINER=4;
	var TARGET_TYPE_IEMS_HOME_TAB=5;
	
	 
	var main = function(ruleContext) {
		var ruleConfig = ruleContext.getRuleCfg();
		var inParams = ruleConfig.inParams;
		var inParamObj = jsonUtil.json2obj(inParams);
	    
		var urlType = inParamObj.urlType;
		var urlstr= inParamObj.url;
		var targetType = inParamObj.targetType;
		var isEncodeURL = inParamObj.isEncodeURL;
		var isShowDialog = inParamObj.isShowDialog ? inParamObj.isShowDialog : false;
	    var targetComponentContainerCode = inParamObj.targetComponentContainerCode;
	    var paramsArray = inParamObj.parameters;
	    var context = new ExpressionContext();
		context.setRouteContext(ruleContext.getRouteContext());
		var url=ExpressEngine.execute({"expression":urlstr,"context":context});//getData(urlType,urlstr);
		
		
		//"打开页面"
		var titleExp=inParamObj.title;
		var title;
		if(!titleExp){
			title="打开页面";
		}else{
			title=ExpressEngine.execute({"expression":titleExp,"context":context});
		}
		var paramStr="";
		for(var i=0;paramsArray!=null && i<paramsArray.length;i++){
			var paramName=paramsArray[i].name;
			var paramValue=getData(paramsArray[i].value,context);
			if(paramStr.length>0)
				paramStr+="&";
			paramStr+=paramName+"="+paramValue;
		}
		
		var errorMsg=null;
		if(url==null || url.lenght==0){
			errorMsg="打开链接地址不能为空！";
		}
		if(targetType!=TARGET_TYPE_CUR_PAGE &&
		   targetType!=TARGET_TYPE_NEW_WINDOW &&
		   targetType!=TARGET_TYPE_COMPONENT_CONTAINER &&
		   targetType!=TARGET_TYPE_DIV_CONTAINER &&
		   targetType!=TARGET_TYPE_COMPONENT_NEW_TAB &&
		   targetType!=TARGET_TYPE_IEMS_HOME_TAB){
		   errorMsg="目标窗口类型不正确！";
		}
		
		if(errorMsg!=null && errorMsg.length>0){
			throw new Error(errorMsg);
		}
		
		if(paramStr.length>0){
			var pos=url.indexOf("?");
			if(pos<0)
				url+="?";
			else if(pos<(url.length-1))
			    url+="&";
			url+=paramStr;
		}
		if(isEncodeURL!=undefined&&(isEncodeURL==true||isEncodeURL=="true")){
			url=encodeURI(url);
		}
		
		log.log("打开链接地址为："+url);
		if (ruleContext.setBusinessRuleResult) {//兼容其他方式使用返回值报错的问题
			ruleContext.setBusinessRuleResult({
				isConfirmSelectionOnClose : undefined
			});
		}
		//当前页面打开
		if(targetType==TARGET_TYPE_CUR_PAGE){
			BrowserUtil.currentPageOpen({
				url : url
			});
//			window.location.href=url;
		}else if(targetType == TARGET_TYPE_COMPONENT_NEW_TAB){/* 新页签打开方式 */
			var widthExp=inParamObj.widthExp;
	    	var heightExp=inParamObj.heightExp;
			var width=null;
			if(widthExp!=null&&widthExp!=""){
				width=parseInt(""+ExpressEngine.execute({"expression":widthExp,"context":context}));
				if(isNaN(width))
				   width=null;
			}
			
			var height=null;
			if(heightExp!=null&&heightExp!=""){
				height=parseInt(""+ExpressEngine.execute({"expression":heightExp,"context":context}));
				if(isNaN(height))
					height=null;
			}
			var tabName = desUtil.toMD5(url);
			var params = {
				"winName":tabName,
				"url":url,
				"title":title,
				"width":width,
				"height":height,
				"closed":(function(context){//关闭回调
					return function(){
						context.fireRuleCallback();
					}
				})(ruleContext)
			}
			BrowserUtil.showModelessDialogExNewTab(params);
		}
		else if(targetType==TARGET_TYPE_NEW_WINDOW){
			var winScope = scopeManager.getWindowScope();
			var series = "";
			if(null == winScope){//规则触发起源不是平台窗体，如第三方页面
				if(navigator.userAgent && navigator.userAgent.indexOf("ydgApp") !=-1){
					series = "bootstrap_mobile";
				}
			}else{
				series = winScope.getSeries();
			}
			if("bootstrap_mobile" != series){
				var widthExp=inParamObj.widthExp;
		    	var heightExp=inParamObj.heightExp;
				var width=null;
				if(widthExp!=null&&widthExp!=""){
					width=parseInt(""+ExpressEngine.execute({"expression":widthExp,"context":context}));
					if(isNaN(width))
					   width=null;
				}
				
				var height=null;
				if(heightExp!=null&&heightExp!=""){
					height=parseInt(""+ExpressEngine.execute({"expression":heightExp,"context":context}));
					if(isNaN(height))
						height=null;
				}
				var winName = uuidUtil.generate();

				var params = {
						"winName":winName,
						"url":url,
						"title":title,
						"width":width,
						"height":height
				}
				if(isShowDialog){
					var returnMappings = inParamObj.returnMapping;
					params["callback"] = function(params){
						if(params && params.isClickConfirm && returnMappings){
							handleOpenWindowReturnValues(ruleContext,params.outputs,returnMappings);
						}
						ruleContext.fireRouteCallback();
					}
					modalByUrlUtil.create(params);
					ruleContext.markRouteExecuteUnAuto();
				}else{
					BrowserUtil.showModelessDialogEx(params);
				}
			}else{
				var userAgent = navigator.userAgent;
				if(userAgent.indexOf("v3app") > 0 || userAgent.indexOf("ydgApp") > 0){
					var config = {};           
					config.url=url;   //创建webview后请求的url地址，需要带http://或https://            （打开H5窗体时必填）
					config.onClose =function(){
						ruleContext.fireRouteCallback();
					};
					ruleContext.markRouteExecuteUnAuto();
					webViewService.openUrl(config);
				}else{
					if(isShowDialog){
						var params = {
							url:url,
							title:title
						}
						params["callback"] = function(){
							ruleContext.fireRouteCallback();
						}
						widgetAction.executeComponentAction("showModalUrl",params);
						ruleContext.markRouteExecuteUnAuto();
					}else{
						var config = {};           
						config.url=url;   //创建webview后请求的url地址，需要带http://或https://            （打开H5窗体时必填）
						config.onClose =function(){
							ruleContext.fireRouteCallback();
						};
						ruleContext.markRouteExecuteUnAuto();
						webViewService.openUrl(config);
					}
				}
			}
//			rendererUtil.showModelessDialogEx("openLink", url, title,null,width,height);
		}
		else if(targetType==TARGET_TYPE_COMPONENT_CONTAINER){ 
		    var tmpActionHandler=widgetAction;
			var targetComponentContainerId=targetComponentContainerCode;
			
//			//非空说明是当前组件容器
//			if(targetComponentContainerId!=null && targetComponentContainerId!="")
//			    tmpActionHandler=widgetAction;
//			else{
//			    tmpActionHandler=rendererUtil.getParentActionHandler(targetComponentContainerCode);
			    //如果没有找到父容器则用新窗口打开
//			    if(tmpActionHandler==null){
//			    	Browser.showModelessDialogEx("openLink", url, title);
//			    	Browser.showModelessDialogEx("openLink", url, title);
//			        return true;
//			    }
//			}
			
			var width=screen.availWidth;
			var height=screen.availHeight;
			var info = {};
			info.title = title;
			info.otherInfo = url;
			// 标注打开方式为container
			var containerId = tmpActionHandler.executeWidgetAction(targetComponentContainerId, "exists", info);
			if(containerId) {
					//因为可能有数据更新了，要先刷新,刷新后再激活
					tmpActionHandler.executeWidgetAction(targetComponentContainerId, "reloadSingleTab",
							"", containerId, title, info.otherInfo, url,true,false);
					tmpActionHandler.executeWidgetAction(targetComponentContainerId, "active", info);
			} else {
					tmpActionHandler.executeWidgetAction(targetComponentContainerId, "add", {
								"id" : null,
								"isComponent":false,
								"title" : title,
								"url" : url,
								"iconCls" : "icon-save",
								"selected" : true
							}, 0);
			}
		}
		else if(targetType==TARGET_TYPE_DIV_CONTAINER){//在div容器打开
//			windowInputParams["variable"]["formulaOpenMode"] = "vuiWindowContainer";
			var winScope = scopeManager.getWindowScope();
			var componentCode = winScope.getComponentCode();
			var windowCode = winScope.getWindowCode();
			var widgetId = inParamObj.divCode;
			var containerCode = inParamObj.targetComponentContainerCode;
			var scopeId = winScope.getInstanceId();
			var callBackFunc = function(params){
				if(!params)
					return;
				var exist = params.existIden===true ? true : false;
				if(!exist){//之前未打开过
					var closeParams = {
						widgetId : widgetId,
						vuiCode : containerCode,
						eventName : "close",
						params : {
							tagIden : params._iden
						}
					}
					var closeFunc = scopeManager.createScopeHandler({
						scopeId : scopeId,
						handler:function(){
							widgetProperty.set(widgetId, "fireVueEvent", closeParams);
						}
					})
					//注册跨域关闭事件
					eventManager.onCrossDomainEvent({
						eventName: eventManager.CrossDomainEvents.ContainerWindowClose,
						handler: closeFunc
					});
				}
			}
			var closeback = function(params){
			}
			
			var containerParam = {
				containerCode:containerCode,/* 这个是标签的code */
				componentCode:componentCode,
				windowCode:windowCode,
				OpenMode:"OpenLink",
				callback : callBackFunc,
				closeback : closeback,
				url : url,
				divCode : widgetId, /* 这个是标签所在div的code */
				title:title
			}
			widgetProperty.set(widgetId, "openWindowToDivContainer", containerParam);
		}
		else if(targetType == TARGET_TYPE_IEMS_HOME_TAB){
			
			ruleContext.markRouteExecuteUnAuto();
			var returnMappings;
			var _callbackLabel = function(params){
				var businessRuleResult = {
					isConfirmSelectionOnClose : false
				}
				if(params){
					businessRuleResult.isConfirmSelectionOnClose = true === params.isConfirmExit;
					if(businessRuleResult.isConfirmSelectionOnClose && params.returnValues){
						handleOpenWindowReturnValues(ruleContext, params.returnValues, returnMappings);
					}
				}
				if (ruleContext.setBusinessRuleResult) {
					ruleContext.setBusinessRuleResult(businessRuleResult);
				}
				ruleContext.fireRouteCallback();
			}
			BrowserUtil.showByHomeTab({
				url : url,
				title : title,
				ruleContext : ruleContext,
				callback : _callbackLabel
			});
		}
		return true;
	}
	
	/**
	 * 处理打开窗体返回信息
	 */
	function handleOpenWindowReturnValues(ruleContext, windowReturnValue, returnMappings) {
		if (!returnMappings || returnMappings.length <= 0) {
			return;
		}

		/**
		 * 内部方法，获取赋值来源值
		 */
		var getSourceValue = function(source, sourceType) {
			var sourceValue = null;
			switch (sourceType) {
				case "returnValue":
					sourceValue = windowReturnValue[source];
					break;
				case "expression":
					var context = new ExpressionContext();
					context.setRouteContext(ruleContext.getRouteContext());
					sourceValue = formulaUtil.execute({
						"expression": source,
						"context": context
					});
					break;
				default:
					break;
			}
			return sourceValue;
		};

		for (var i = 0; i < returnMappings.length; i++) {
			var mappings = returnMappings[i];
			var destName = mappings["dest"];
			var destType = mappings["destType"];

			var sourceName = mappings["src"];
			var sourceType = mappings["srcType"];
			var sourceValue = getSourceValue(sourceName, sourceType);

			if (!dbService.isEntity(destName, destType, ruleContext)) {//暂不支持实体
				switch (destType) {
					case "control":
						var dsName = windowVmManager.getDatasourceNamesByWidgetCode({
							"widgetCode": destName
						})[0];
						var dataSource = datasourceManager.lookup({
							"datasourceName": dsName
						});
						//var record = dataSource.getCurrentRecord();
						var field = windowVmManager.getFieldCodesByWidgetCode({
							"widgetCode": destName,
							"datasourceName": dsName
						})[0];
						//record.set(field, sourceValue);
						
						datasourcePusher.setFieldValue({
							"datasourceName": dsName,
							"fieldCode": field,
							"value": sourceValue
						});
						break;
					case "windowVariant":
						windowParam.setInput({
							"code": destName,
							"value": sourceValue
						});
						break;
					case "systemVariant":
						componentParam.setVariant({
							"code": destName,
							"value": sourceValue
						});
						break;
					case "ruleSetVariant":
						ruleContext.getRouteContext().setVariable(destName, sourceValue);
						break;
					case "ruleSetOutput":
						ruleContext.getRouteContext().setOutputParam(destName, sourceValue);
						break;
					case "windowOutput":
						windowParam.setOutput({
							"code": destName,
							"value": sourceValue
						});
						break;
					default:
						break;
				}
			}
		}
	};
	
	function toString(obj) {
		return obj == null ? '' : obj.toString();
	}
	//dengb:去掉来源类型的判断逻辑，现在只要一直来源就是表达式
	
	function getData(value,context){
	    if(value==null )
	       return "";
	    var val="";
	    val=ExpressEngine.execute({"expression":value,"context":context});
		val+=""; //转换成字符串，否则传递到后台的参数可能不是字符串类型而出错
		return val;
	}
	
	exports.main = main;

export{    main}