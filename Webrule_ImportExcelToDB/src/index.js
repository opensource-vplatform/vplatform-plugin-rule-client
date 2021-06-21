/**
 *
 *
 */

	var logUtil;
	var jsonUtil;
	var viewModel;
	// 增加公式解析引用 zhangliang
	var ExceptionFactory;
	var scopeManager;
	var componentParam;
	var windowParam;
	var manager;
	var dataValidateUtil;
	var ExpressionContext;
	var engine;
	var widgetAction;
	var pusher;
	var factory;
	var widgetContext;
	var genUUID = function() {
        var S4 = function() {
            return (((1 + Math.random()) * 0x10000) | 0).toString(16)
                .substring(1);
        };
        return (S4() + S4() + S4() + S4() + S4() + S4() + S4() + S4());
    };
	
	exports.initModule = function(sBox) {
//		logUtil = require("system/util/logUtil");
		logUtil = sBox.getService("vjs.framework.extension.util.log");
		dataValidateUtil = sBox.getService("vjs.framework.extension.util.DataValidateUtil");
		jsonUtil = sBox.getService("vjs.framework.extension.util.JsonUtil");
//		viewContext = require('system/view/viewContext');
		componentParam = sBox.getService("vjs.framework.extension.platform.data.storage.runtime.param.ComponentParam");
		windowParam = sBox.getService("vjs.framework.extension.platform.services.param.manager.WindowParam");
		
//		viewModel = require("system/view/viewModel");
		manager = sBox.getService("vjs.framework.extension.platform.services.model.manager.datasource.DatasourceManager");
		pusher = sBox.getService("vjs.framework.extension.platform.services.domain.datasource.DatasourcePusher");
		
//		dbManager = require("system/manager/dbManager");
		
//		formulaUtil = require("system/util/formulaUtil");
		ExpressionContext = sBox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionContext");
		engine = sBox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionEngine");
		
//		actionHandler = require("system/widget/actionHandler");
		widgetAction = sBox.getService("vjs.framework.extension.platform.services.view.widget.common.action.WidgetAction");
		
//		ExceptionFactory = require("system/exception/ExceptionFactory");
		factory = sBox.getService("vjs.framework.extension.platform.interface.exception.ExceptionFactory");
		
		scopeManager = sBox.getService("vjs.framework.extension.platform.interface.scope.ScopeManager");
	

		widgetContext = sBox.getService("vjs.framework.extension.platform.services.view.widget.common.context.WidgetContext");
	}
	function GetTreeStruct(treeStruct,tableName){
		for(var i = 0;i<treeStruct.length;i++){
			var _var = treeStruct[i];
			if(tableName==_var["tableName"]){
				return _var;
			}
		}
		return null;
	}
	function MapTransform(inParamObj,ruleContext){
		var result = {};
		result["fileSource"] = inParamObj["fileSource"];
		result["treeStruct"] = inParamObj["treeStruct"];
		var _rel = [];
		var context = new ExpressionContext();
		context.setRouteContext(ruleContext.getRouteContext());
		
		for(var i = 0;i<inParamObj["items"].length;i++){
			var _re = {};
			var _inParamObj = inParamObj["items"][i];
			_re["fileType"] = "Excel";
			_re["dataName"] = _inParamObj["targetTable"];
			var retValue = engine.execute({"expression":_inParamObj["sheetNum"],"context":context});
			_re["sheetNum"] = Number(retValue);
			_re["startRow"] = _inParamObj["dataStartRow"];
			_re["importNodeId"] = _inParamObj["importNodeId"];
			var _ma = [];
			for(var j=0;j<_inParamObj["mapping"].length;j++){
				var _map = {};
				var _mapping = _inParamObj["mapping"][j];
				_map["chineseName"] = _mapping["fieldName"];
				_map["fieldName"] = _mapping["fieldCode"];
				if(_mapping["sourceType"]=="excelColName"){
					_map["source"] = "Excel";
				}else if("excelColNum"==_mapping["sourceType"]){
					_map["source"] = "ExcelColCode";
				}else{
					_map["source"] = _mapping["sourceType"];
				}
				_map["value"] = _mapping["sourceValue"];
				_ma[j] = _map;
			}
			_re["dgcolumn"] = _ma;
			_rel[i] = _re;
		}
		result["items"] = _rel;
		return result;
	}
	var main = function(ruleContext) {
		var ruleConfig = ruleContext.getRuleCfg();
		var inParams = ruleConfig.inParams;
		var inParamObj = jsonUtil.json2obj(inParams);
		inParamObj = MapTransform(inParamObj,ruleContext);
		var fileSource = inParamObj.fileSource;// 上传控件id
		var useAttachment = true ;
		if (fileSource == null || fileSource == "") {
			useAttachment = false ;
//			alert("规则配置中的上传控件id不能为空");
//			return false;
		}
//		var comp = widgetAction.executeWidgetAction(fileSource, "getComponent")
		var widget = widgetContext.get(fileSource, "widgetObj");
		if (!widget) {
			useAttachment = false ;
//			alert('找不到执行导入的文件控件');
//			return false;
		}
		var selectIdList = {};
		var varMapList = {};
		var tmpm = [];
		for(var a = 0;a<inParamObj["items"].length;a++){
			var _inParamObj = inParamObj["items"][a];
			var dataSourceName = _inParamObj.dataName;
			var sheetn = _inParamObj.sheetNum;
			var _ide = dataSourceName+"_"+sheetn;
			if(!tmpm.contains(_ide)){
				tmpm[a]=_ide;
			}else{
				HandleException("同一个sheetno不能导入相同的表中");
				return false;
			}
			var treeStruct =inParamObj["treeStruct"]==null?null:GetTreeStruct(inParamObj["treeStruct"],dataSourceName);// 获取树结构配置
			//inParamObj["items"][a]["treeStruct"] = treeStruct==null?"":treeStruct;
			inParamObj["items"][a]["treeStruct"] = treeStruct;//==null?"":treeStruct;
			var dataType = treeStruct!=null?"tree":"Table"; // 为Table或Tree
			inParamObj["items"][a]["dataType"] = dataType;//==null?"":treeStruct;
			var importNodeId = treeStruct!=null?_inParamObj["importNodeId"]:"";// 导入目标树节点id
			dataType = dataType.toLowerCase();
//			// 得到导入的目标节点id值
			var selectId = '';
			if (dataType == "tree") {
				if (treeStruct == null || treeStruct.length == 0) {
					throw new Error("规则配置中没有树结构信息", undefined, undefined, factory.TYPES.Config);
					return false;
				}
				if (treeStruct.type != "1" && treeStruct.type != "2") {
					throw new Error("规则配置中树类型只能为层级码树或左右树", undefined, undefined, factory.TYPES.Config);
					return false;
				}
				if (importNodeId != null && importNodeId != "") {
//					selectId = formulaUtil.evalExpression(importNodeId);
					var context = new ExpressionContext();
					context.setRouteContext(ruleContext.getRouteContext());
					selectId = engine.execute({"expression":importNodeId,"context":context});
					selectIdList[dataSourceName] = selectId;
				}
			}
//			// 得到字段值包括表达式 Express、实体字段 Entity、系统变量 System、组件变量 Component
			var varMap = {};
			for (var i = 0; i < _inParamObj.dgcolumn.length; i++) {
				var source = _inParamObj.dgcolumn[i].source;
				var fieldCode = _inParamObj.dgcolumn[i].fieldName;
				var value = _inParamObj.dgcolumn[i].value;
				var sheetno = _inParamObj.sheetNum;
				if (source === 'Entity') {
					dataSourceName = value.substring(0, value.indexOf("."));
//					var currentRow = viewModel.getDataModule().getCurrentRowByDS(dataSourceName);
					var datasource = manager.lookup({"datasourceName":dataSourceName});
					var currentRow = datasource.getCurrentRecord();
					
					
//					var db = dbManager.getDB(dataSourceName);
					var datasource = manager.lookup({"datasourceName":changeDsArr[changeIndex]});
					var db = datasourceclearRemoveDatas();
					
					if (currentRow != null) {
						varMap[fieldCode] = currentRow.get(value);
					} else {
						varMap[fieldCode] = null;
					}
				} else if (source === 'System') {
					// 如果是系统变量
//					varMap[fieldName] = viewContext.getSystemVariableValue(value);
					varMap[fieldCode] = componentParam.getVariant({"code":value});
				} else if (source === 'Component') {
					// 如果是组件变量
//					varMap[fieldName] = viewContext.getVariableValue(value);
					varMap[fieldCode] = windowParam.getInput({"code":value});
				} else if (source === 'Express' || source === 'expression') {
					// 如果是表达式
					// 2015-05-29 liangchaohui：3.x后改成expression
//					varMap[fieldName] = formulaUtil.evalExpression(value);
					var context = new ExpressionContext();
					context.setRouteContext(ruleContext.getRouteContext());
					varMap[fieldCode] = engine.execute({"expression":value,"context":context});
				}
				varMapList[_ide] = varMap;
			}
		}
		

		var actionType = "importTable";
		var routeRuntime = ruleContext.getRouteContext();
		var transactionId = routeRuntime.getTransactionId();
		// actionType="importEntity";
		var option = {
			ruleInstId : ruleConfig.instanceCode,
			selectId : selectIdList,
			action : actionType,
			varMap : varMapList,
			ruleConfig : jsonUtil.obj2json(inParamObj),
			instance : transactionId,/**不知道干什么的,可能多余的 jiqj */
			transactionId: transactionId /**后台需要这个进行事物管理, 事物id变量错误，导致没有与前一个事务串联 jiqj*/
		};
		//获取规则路由上下文
		/*
		var routeContext = ruleContext.getRouteConteext();
		//获取规则链路上下文的事物id
		var transactionId = routeContext.getTransactionId();
		*/
		//console.log("获取规则链路上下文的事物jiqj id:" + transactionId);
		
		var scopeId = scopeManager.getCurrentScopeId();
		var callback = function(arg1, arg2) {
			scopeManager.openScope(scopeId);
			try {
				logUtil.log("结束发送时间：" + new Date().toLocaleTimeString());
				if (arg2) {
					if (arg2.success) {
						ruleContext.setRuleStatus(true);
						ruleContext.fireRuleCallback();
						ruleContext.fireRouteCallback();
					} else {
						var type = arg2.exceptionType;
						var msg = arg2.msg;
//						var exception = ExceptionFactory.create(type, msg);
						var exception = factory.create(arg2);
						exception.markServiceException();
						//TYPES枚举值：Expected，UnExpected，Business，Dialog，Unlogin，Expression
//						var exception = ruleContext.createRuleException({
//							"exception": new Error(arg2.msg),
//							"exceptionType":type
//						});
						ruleContext.handleException(exception);
					}
					
				} else {
					logUtil.error("上传控件回调参数不正确，请处理！");
				}
			} finally {
				
				scopeManager.closeScope();
				
			}
		}
		var start = new Date();
		logUtil.log("开始发送时间：" + start.toLocaleTimeString());
		ruleContext.markRouteExecuteUnAuto();
		
		//创建input表单
		// 创建好以后出发点击事件
		// 文件选择事件中出发后续逻辑
		// 逻辑完成后触发删除之前创建的input表单
		if(useAttachment){
			widgetAction.executeWidgetAction(fileSource, "importData", option, callback)
		}else{
			option.componentCode = scopeManager.getScope().getComponentCode();
			option.windowCode = scopeManager.getWindowScope().getWindowCode();
			if($("#importExcelToDBFileButton").length > 0){
				$("#importExcelToDBFileButton").next().remove();
				$("#importExcelToDBFileButton").remove();
			}
			
			var fileInput = "<div id='importExcelToDBFileButton' style='display:none'>隐藏按钮</div>" ;
			$("body").append(fileInput);
			
			var error_msg ;
			var plupload_upload_obj = new plupload.Uploader({ //实例化一个plupload上传对象
	            runtimes: 'html5,flash,html4',
	            browse_button: 'importExcelToDBFileButton',
	            url: 'module-operation!executeOperation?operation=FileUpload&ajaxRequest=true',
	            multipart_params: {},
	            multi_selection:false,
//	            filters: {
//	                mime_types: [{
//	                    title: "files",
//	                    extensions: control_sc_obj.file_types != undefined ? control_sc_obj.file_types.replaceAll("*.", "").replaceAll(";", ",") : "*"
//	                }],
//	                max_file_size: control_sc_obj.file_size_limit + 'kb'
//	            },
	            init: {
	                "FilesAdded": function(uploader, files) { //添加文件触发
	                	plupload_upload_obj.start();
	                },
	                "FileUploaded": function(uploader, file, responseObject) { //每个文件上传完成触发
	                	error_msg = isc.JSON.decode(responseObject.response);
//	                	console.log("导入数据事件：FileUploaded"  );
	                },
	                "UploadComplete": function(uploader, files) { //全部文件上传完成触发
	                	callback(files , error_msg);
	                },
	                "Init":function(){
//	                	$("#importExcelToDBFileButton").next().children().change(function(){
//	                		
//	                	})
	                	$("#importExcelToDBFileButton").next().children().click();
	                	
	                }
	            }
	        });
	         var token = {
	             data: {
	                 'dataId': genUUID(),
	                 'action': 'importTable',
	                 'cfg': option,
	                 'componentCode': option.componentCode,
	                 'windowCode': option.windowCode,
	                 "transaction_id": option.transactionId
	             }
	         };
	         var appendUrl = plupload_upload_obj.settings.url;
	         appendUrl += "&" + "componentCode=" + option.componentCode;
	         appendUrl += "&" + "windowCode=" + option.windowCode;
	         plupload_upload_obj.settings.url = appendUrl;
	         plupload_upload_obj._handleRequestDataByV3 = function(datas){
	     		if(datas && dataValidateUtil.genAsciiCode){
	    			var url = this.settings.url;
	    			if(undefined != url && url.indexOf("?") != -1){
	    				var urlParamArr = url.split("?")[1].split("&");
	    				for(var i = 0, len = urlParamArr.length; i<len; i++){
	    					var param = urlParamArr[i];
	    					if(param.indexOf("=")!=-1){
	    						var paramArr = param.split("=");
	    						datas[paramArr[0]] = paramArr[1];
	    					}
	    				}
	    			}
	    			var map = dataValidateUtil.genAsciiCode(datas);
	    			return map;
	    		}
	    	}
	        plupload_upload_obj.settings.multipart_params.token = encodeURI(isc.JSON.encode(token));
	        plupload_upload_obj.init();
			ruleContext.setRuleCallback(true);
		}
		return true;
	}
	//异常处理方法
	function HandleException(tmpvar){
		var exception = factory.create({"type":factory.TYPES.Business, "message":tmpvar});
    	exception.handle();
	}
	//注册规则主入口方法(必须有)
	exports.main = main;

export{    main}