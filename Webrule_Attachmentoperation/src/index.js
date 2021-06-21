/**
 * 附件操作 <code>
 * {
 *	"componentControlID" : [{
 *				"componentControlID" : "ad4e0d4c817b4d688e9043b49b55cc7d" //控件Id
 *			}],
 *	"dataProcess" : "my_file111.fileId", //文件标识字段
 *	"function" : "2" //操作类型
 * }
 * </code>
 */

	var jsonUtil;
	var scopeManager;
	var manager;
	var datasourcePuller;
	var datasourceUtil;
	var widgetAction;
	var browser;
	var formulaUtil;
	var ExpressionContext;
	var windowVMMappingManager;
	var widgetContext;
	var operation;
	var remoteMethodAccessor;
	var log;
	var factory;
	var modalByUrlUtil;
	var dcs;
	var widgetDatasource;
	var exceptionHandler;
	var widgetProperty;
	
	exports.initModule = function(sBox) {
		jsonUtil = sBox
				.getService("vjs.framework.extension.util.JsonUtil");
		scopeManager = sBox
				.getService("vjs.framework.extension.platform.interface.scope.ScopeManager");
		manager = sBox
				.getService("vjs.framework.extension.platform.services.model.manager.datasource.DatasourceManager");
		datasourcePuller = sBox
				.getService("vjs.framework.extension.platform.services.domain.datasource.DatasourcePuller");
		datasourceUtil = sBox
				.getService("vjs.framework.extension.platform.services.view.logic.datasource.DatasourceUtil");
		widgetAction = sBox
				.getService("vjs.framework.extension.platform.services.view.widget.common.action.WidgetAction");
		browser = sBox
				.getService("vjs.framework.extension.platform.services.browser.Browser");
		formulaUtil = sBox
				.getService("vjs.framework.extension.platform.engine.expression.ExpressionEngine");
		ExpressionContext = sBox
				.getService("vjs.framework.extension.platform.engine.expression.ExpressionContext");
		windowVMMappingManager = sBox.getService("vjs.framework.extension.platform.services.vmmapping.manager.WindowVMMappingManager");
		widgetProperty = sBox.getService("vjs.framework.extension.platform.services.view.widget.common.action.WidgetProperty");
		widgetContext = sBox.getService("vjs.framework.extension.platform.services.view.widget.common.context.WidgetContext");
		
		operation = sBox.getService("vjs.framework.extension.system.RPC");
		
		remoteMethodAccessor = sBox.getService("vjs.framework.extension.platform.services.operation.remote.RemoteMethodAccessor");
		widgetDatasource = sBox.getService("vjs.framework.extension.platform.services.view.widget.common.logic.datasource.WidgetDatasource");
	
		modalByUrlUtil = sBox.getService("vjs.framework.extension.platform.services.view.modal.CreateModalByUrl");
		log = sBox.getService("vjs.framework.extension.util.log");
		factory = sBox.getService("vjs.framework.extension.platform.interface.exception.ExceptionFactory");
		dcs = sBox.getService("vjs.framework.extension.platform.services.Dcs");
		exceptionHandler = sBox.getService("vjs.framework.extension.platform.interface.exception.ExceptionHandler");

	}

	// 操作类型：上传、下载、删除、预览
	var OP_UPLOAD = '1', OP_DOWNLOAD = '2', OP_DELETE = '3', OP_PREVIEW = '4';
	var ERRORNAME = "规则[Attachmentoperation]：";
	function main(ruleContext) {
		var ruleConfig = ruleContext.getRuleCfg();
		var inParams = ruleConfig.inParams;
		var inParamObj = jsonUtil.json2obj(inParams);
		/* 预览类型：新标签页-newTabPage，当前页面-currentPage，新窗体-newWindow */
		var previewTargetType = inParamObj.previewTargetType;
		/* 预览窗体大小(新窗体才有配置)：默认-default，最大化-maximize */
		var previewWindowSize = inParamObj.previewWindowSize;
		previewWindowSize = previewWindowSize && previewWindowSize == "maximize" ? "Maximized" : null;
		/* 是否是模态(新窗体才有配置)：true/false 默认为false */
		var isPreviewInModalWindow = inParamObj.isPreviewInModalWindow;
		// 控件数组
		var controls = inParamObj.componentControlCode;
		// 文件标识字段
		var fileIdField = inParamObj.dataProcess;
		// 原文件名称
		var oldFileName = inParamObj.fileName;
		// 文件类型
		var fileType = inParamObj.fileType;
		// 构件编码
//		var componentCode = inParamObj.componentCode;//不使用规则配置，改用规则当前所在的构件Task20210309159
		var componentCode = scopeManager.getWindowScope().getComponentCode();
		// 操作类型
		var operation = inParamObj['function'];
		// 预览类型 pdfjs,yozodcs 其他 操作为""
		var reviewScheme = inParamObj["reviewScheme"];
        //水印设置的参数
		var watermarkEnable = inParamObj.watermarkEnable;
		var waterParamSet = {};
		if(watermarkEnable){
			waterParamSet.watermarkSet = inParamObj.watermarkSet;
			waterParamSet.picWatermarkStyle = inParamObj.picWatermarkStyle;
			waterParamSet.docProtectSet = inParamObj.docProtectSet;//增加文档保护设置
		}
		var scope = scopeManager.getWindowScope();
		var moduleId = scope.getWindowCode();

		var context = new ExpressionContext();
		context.setRouteContext(ruleContext.getRouteContext());
		
//		operation = "2" ;
//		fileType = "expression";
//		fileIdField = "\"8a819b31715273dd017153ae9e0905f7\"" ;
		
		try {
			switch (operation) {
			case OP_UPLOAD:
				ruleContext.markRouteExecuteUnAuto();
				doUpload(controls, ruleContext);
				ruleContext.setRuleCallback(true);
				break;
			case OP_DOWNLOAD:
				doDownload(fileType, fileIdField, oldFileName,
						moduleId, componentCode, context,waterParamSet);
				break;
			case OP_DELETE:
				doDelete(fileIdField);
				break;
			case OP_PREVIEW:
				doPreview({
					fileIdField : fileIdField,
					moduleId : moduleId, 
					fileType : fileType, 
					context : context,
					previewTargetType : previewTargetType,
					previewWindowSize : previewWindowSize,
					isPreviewInModalWindow : isPreviewInModalWindow,
					ruleContext : ruleContext,
					reviewScheme : reviewScheme,
					waterParamSet : waterParamSet
				});
				break;
			}
		} catch (e) {
			// alert(e.message);
			// 处理IE下console的兼容问题
			if (window.console && console.log)
				console.log(e.message);
			return;
		}
	}

	/**
	 * 上传操作
	 */
	function doUpload(controls, ruleContext) {
		if (!controls || controls.length == 0)
			throw new Error('配置有误：未指定上传控件！');
		var callback = function(fileObj, resultObj) {
			return function() {
				ruleContext.fireRouteCallback();
			}();
		};
		
		var errorCB = function(errorMessage){
			var routeContext = ruleContext.getRouteContext() ;
			routeContext.markForInterrupt(routeContext.CURRENT);
			if(factory.isException(errorMessage)){
				exceptionHandler.handle(errorMessage);
			}else{//应该从源头封装好异常对象
				alert(errorMessage) ;
			}
		}

		
		for ( var i = 0; i < controls.length; i++) {
			/* 控件编码 */
			var widgetId = controls[i].componentControlCode;
			var fileUploaded = widgetAction.executeWidgetAction(widgetId, "getFileUploaded");
			if(!fileUploaded){
				fileUploaded = function(){}
			}
			/* 单个文件上传后执行的方法 */
			var singleFileUploadedFunc = ruleContext.genAsynCallback(fileUploaded);
			widgetAction.executeWidgetAction(widgetId, "upload",
					callback,{'singleFileUploaded':singleFileUploadedFunc , 'errorCB':errorCB});
		}
	}

	/**
	 * 根据字段描述获取dataSourceName
	 */
	function getDataSourceName(fileIdField) {
		if (!fileIdField)
			throw new Error('配置有误：文件标识字段未指定！');
		var parts = fileIdField.split('.');
		if (parts.length == 0)
			throw new Error('配置有误：文件字段需要配置为表名.字段名形式！fieldName='
					+ fileIdField);
		return parts[0];
	}

	/**
	 * 获取第一个选中记录的文件Id
	 */
	function getFirstSelectedFileId(fileIdField) {
		var dataSourceName = getDataSourceName(fileIdField);
		// var rows =
		// viewModel.getDataModule().getSelectedRowsByDS(dataSourceName);
		var datasource = manager.lookup({
			"datasourceName" : dataSourceName
		});
		var rs = datasource.getSelectedRecords();
		var rows = rs.toArray();
		if (!rows || rows.length == 0) {
			throw new Error('请选择要操作的文件！');
		}
		var fileId = rows[0].get(getFieldName(fileIdField));
		if (!fileId)
			throw new Error('文件尚未上传！');
		return fileId;
	}

	/**
	 * 获取选中的所有文件Id
	 */
	function getSelectedFileIds(fileIdField) {
		var dataSourceName = getDataSourceName(fileIdField);
		var _filterEntity = {
				"datasourceName": dataSourceName
			}
		var widgetCodes = windowVMMappingManager.getWidgetCodesByDatasourceName(_filterEntity);
		var chooseMode=0;
		if (widgetCodes && widgetCodes.length > 0) {
			for (var j = 0, len = widgetCodes.length; j < len; j++) {
				var widget = widgetContext.get(widgetCodes[j], "widgetObj");
				if (widget && widget.type=="JGDataGrid"){
					chooseMode = widget.ChooseMode;
				}
			}
		}
		var rows;
		if(chooseMode==0){
			rows = datasourcePuller.getSelectedAndCurrentRecords({
				"datasourceName" : dataSourceName
			});
		}else{
			var datasource = manager.lookup({
				"datasourceName" : dataSourceName
			});
			var rs = datasource.getSelectedRecords();
			rows = rs.toArray();
		}
		if (!rows || rows.length == 0) {
			throw new Error('请选择要操作的文件！');
		}

		var fileIds = [];
		for ( var i = 0; i < rows.length; i++) {
			var fileId = rows[i].get(getFieldName(fileIdField));
			if (!fileId)
				continue;
			fileIds.push(fileId);
		}
		return fileIds;
	}

	/**
	 * 获取选中行
	 */
	function getSelectedRecords(fileIdField) {
		var dataSourceName = getDataSourceName(fileIdField);
		// var rows =
		// viewModel.getDataModule().getSelectedOrCurrentRowByDS(dataSourceName);
		var rows = datasourcePuller.getSelectedAndCurrentRecords({
			"datasourceName" : dataSourceName
		});
		if (!rows || rows.length == 0) {
			throw new Error('请选择要操作的文件！');
		}
		return rows;
	}

	var getFieldName = function(fieldName) {
		if (fieldName != null && fieldName.indexOf(".") > 0)
			return fieldName.split(".")[1];
		return fieldName;
	};

	/**
	 * 执行下载操作(下载选中的文件,分为static/dynamic两种类型)
	 */
	function doDownload(fileType, fileIdField, oldFileName, moduleId,
			componentCode, context,waterParamSet) {
		var download_url = 'module-operation!executeOperation?moduleId='
				+ moduleId + '&operation=FileDown';
		var token = {};
		var fileName="";
		if (fileType == 'expression') {
			var fileid = formulaUtil.execute({
				"expression" : fileIdField,
				"context" : context
			});
			if(oldFileName!=null && oldFileName!=""){
				fileName = formulaUtil.execute({
					"expression" : oldFileName,
					"context" : context
				});
			}
			token = {
				data : {
					'isMulti' : false,
					'dataId' : fileid,
					'oldFileName' : fileName
				}
			};
		} else if (fileType == 'static') {
			var filePath = "itop/resources/" + componentCode + "_"
					+ fileIdField;
			token = {
				data : {
					'staticFilePath' : filePath,
					'oldFileName' : oldFileName
				}
			};
		} else {
			var fileIds = getSelectedFileIds(fileIdField);
			if (fileIds.length == 0)
				throw new Error('文件不存在！');
			if(oldFileName!=null && oldFileName!=""){
				fileName = formulaUtil.execute({
					"expression" : oldFileName,
					"context" : context
				});
			}
			token = {
				data : {
					'isMulti' : (fileIds.length > 1),
					'dataId' : (fileIds.length > 1) ? fileIds
							: fileIds[0],
					'oldFileName' : fileName
				}
			};
		}
		//处理水印参数
		console.log(waterParamSet);
		if(!$.isEmptyObject(waterParamSet)){
			var watermarkFileType = "";
			//var watermarkType = "picWatermark";
			var watermarkType = "";//根据水印类型(无/图片水印)，确定是否加水印
			var watermarkFileProtect = "";//文档保护类型（无/限制编辑）
			var docPassWord = "";//文档保护密码
			var watermarkSrcFile = null;
			var watermarkZoom = "100%";
		    var watermarkLocation = "center";
			if(waterParamSet.watermarkSet){
				//文件类型
				for(var i = 0;i < waterParamSet.watermarkSet.length;i++){
					watermarkFileType += waterParamSet.watermarkSet[i].watermarkFileType + ",";
					var watermarkTypeStr = waterParamSet.watermarkSet[i].watermarkType;
					if(watermarkTypeStr != ""){
						watermarkType += waterParamSet.watermarkSet[i].watermarkType + ",";
					}else{
						watermarkType += "none"+",";
					}
					var watermarkFileProtectStr = waterParamSet.watermarkSet[i].watermarkFileProtect;
					if(watermarkFileProtectStr != ""){
						watermarkFileProtect += waterParamSet.watermarkSet[i].watermarkFileProtect + ",";
					}else{
						watermarkFileProtect += "none"+",";
					}
				}
				watermarkFileType = watermarkFileType.substring(0, (watermarkFileType.length-1));
				//watermarkType = waterParamSet.watermarkSet[0].watermarkType;
				watermarkType = watermarkType.substring(0, (watermarkType.length-1));
				watermarkFileProtect = watermarkFileProtect.substring(0, (watermarkFileProtect.length-1));
			}
			if(waterParamSet.picWatermarkStyle){
				watermarkSrcFile = "itop/resources/" + componentCode + "_"+ waterParamSet.picWatermarkStyle[0].watermarkFile;
				watermarkZoom = waterParamSet.picWatermarkStyle[0].watermarkZoom;
				watermarkLocation = waterParamSet.picWatermarkStyle[0].watermarkLocation;
			}
			if(waterParamSet.docProtectSet){
				docPassWord = waterParamSet.docProtectSet[0].docPassWord;
				if(docPassWord != ""){
					docPassWord = formulaUtil.execute({
						"expression" : docPassWord,
						"context" : context
					});
				}
			}
			if(watermarkSrcFile){
				token.data.watermarkEnable = true;
				token.data.watermarkSrcFile = watermarkSrcFile;
				token.data.watermarkFileType = watermarkFileType;
				token.data.watermarkType = watermarkType;
				token.data.watermarkFileProtect = watermarkFileProtect;
				token.data.watermarkZoom = watermarkZoom.replace("%","");
				token.data.watermarkLocation = watermarkLocation;
				token.data.docPassWord = docPassWord;//文档保护密码
			}else{
				token.data.watermarkEnable = true;
				token.data.docPassWord = docPassWord;//文档保护密码
			}	
		}else{
			token.data.watermarkEnable = false;
		}
		var prefix = download_url.indexOf('?') == -1 ? '?' : '&';
		var url = download_url + prefix + 'token='
				+ encodeURIComponent(jsonUtil.obj2json(token));
		
		var mIsApp = isApp();
		var mIsIOS = isIOS() ;
		var mIsAndroid = isAndroid();
		if(mIsApp){
			url = VPlatformPatch.getServiceAddr() + "/" + url ;
			if(mIsIOS){
				alert("文件下载不支持iOS系统");
			}else if(mIsAndroid){
				if(cordova.plugins.system.config.systemDownload){
					cordova.plugins.system.config.systemDownload(url);
				}else{
					alert("当前客户端不支持文件下载，请升级客户端。")
				}
				
			}
		}else{
			if(mIsIOS){
				alert("文件下载不支持iOS系统");
				
//				var iOSVersion = getIOSVersion();
//				if(iOSVersion !=null && iOSVersion instanceof Array && iOSVersion.length > 0 && iOSVersion[0]>=11 &&isSafariBrowser()){
//					createIFrame("file_down_iframe", url);
//				}else{
//					alert("文件下载不支持iOS系统");
//				}
				
			}else{
				createIFrame("file_down_iframe", url);
			}
			
		}
	}
	
	function getIOSVersion(){
		var ua = navigator.userAgent.toLowerCase();
		if(ua.indexOf("like mac os x") > 0){
			var reg = /os [\d._]*/gi ;
			var verinfo = ua.match(reg) ;
			var version = (verinfo+"").replace(/[^0-9|_.]/ig,"").replace(/_/ig,".");
			var arr=version.split(".");
			return arr;
		}else 
			return null;
	}
	
	function isSafariBrowser(){
		return /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
	}
	
	function isWechat(){
		var ua = navigator.userAgent.toLowerCase();
		if(ua.match(/MicroMessenger/i)=="micromessenger") {
			return true;
	 	} else {
			return false;
		}
	}

	function isDingDing(){
		var ua = navigator.userAgent;
		if(ua.match(/DingTalk/i)=="DingTalk") {
			return true;
	 	} else {
			return false;
		}
	}

	function isAndroid(){
		var ua = navigator.userAgent;
		if(ua.match(/Android/i)=="Android") {
			return true;
	 	} else {
			return false;
		}
	}
	
	function isIOS(){
		return /(iPhone|iPad|iPod|iOS)/i.test(navigator.userAgent);
	}
	
	function isApp(){
		return navigator.userAgent.match(/ydgApp/i) == "ydgApp" ;
	}

	function createIFrame(iframeId, url) {
		var iframeObj = document.getElementById(iframeId);
		if (iframeObj == null) {
			iframeObj = document.createElement("iframe");
			iframeObj.setAttribute("id", iframeId);
			iframeObj.setAttribute("style", "display:none");
			document.body.appendChild(iframeObj);
		}
		iframeObj.setAttribute("src", url);
	}

	/**
	 * 执行删除操作(删除所有选中的文件)
	 */
	function doDelete(fileIdField) {

		/*
		 * 附件删除--不再调用文件服务，作用1：可以消除删除但未保存时文件的不一致状态 //先删除已上传的附件 var
		 * fileIds = getSelectedFileIds(fileIdField); if(fileIds.length ==
		 * 0) return;
		 * 
		 * var data = { 'isMulti' : (fileIds.length > 1), 'dataId' :
		 * (fileIds.length > 1) ? fileIds : fileIds[0] }; var result =
		 * viewOperation.doRequest(viewContext.getModuleId(), "FileDel",
		 * jsonUtil.obj2json(data)); if (result.success != true) { throw
		 * new Error("删除文件出错."); }
		 */

		var delRecords = getSelectedRecords(fileIdField);
		if (delRecords == null || delRecords.length == 0)
			return;
		for ( var i = 0; i < delRecords.length; i++) {
			delRecords[i].set(getFieldName(fileIdField), null);
		}
		// viewModel.getDataModule().setBaseValueByDS(getDataSourceName(fileIdField),
		// delRecords, true);
		datasourceUtil.setBaseValue(getDataSourceName(fileIdField),
				delRecords)
	}

	/**
	 * 预览操作(选中的第一个文件)
	 */
	function doPreview(params) {
		var fileIdField = params.fileIdField, 
			moduleId = params.moduleId, 
			fileType = params. fileType,
			context = params.context,
			ruleContext = params.ruleContext,
			reviewScheme = params.reviewScheme,
			previewTargetType = params.previewTargetType,
			previewWindowSize = params.previewWindowSize,
			isPreviewInModalWindow = params.isPreviewInModalWindow,
			waterParamSet = params.waterParamSet;
		// 预览链接
//		var preview_url = 'module-operation!executeOperation?moduleId='
//				+ moduleId + '&operation=OpenPreviewPage';
//		// 预览检查链接
//		var preview_check_url = 'module-operation!executeOperation?moduleId='
//				+ moduleId + '&operation=IsSupportPreviewByAjax';
		var fileId = null;
		if (fileType == 'expression') {
			fileId = formulaUtil.execute({
				"expression" : fileIdField,
				"context" : context
			});
		} else {
			fileId = getFirstSelectedFileId(fileIdField);
		}
		var title = "附件预览";
		var width = document.documentElement.clientWidth;
		var height = document.documentElement.clientHeight;
		width=width/2;
		height=height/2;
//		if (width < 800)
//			width = 800;
//		if (height < 600)
//			height = 600;
//		console.log("width:"+width);
//		console.log("height:"+height);
		if(!reviewScheme || reviewScheme=="pdfjs"|| reviewScheme==""){
			previewTargetType = typeof(previewTargetType) === "undefined" ? "newTabPage" : previewTargetType;
			/* 调用pdfjs服务 */
			callPdfjs({
				ruleContext : ruleContext, 
				fileId : fileId,
				previewTargetType : previewTargetType,
				previewWindowSize : previewWindowSize,
				waterParamSet : waterParamSet,
				isPreviewInModalWindow : isPreviewInModalWindow
			});
		}else if(reviewScheme=="yozodcs"){
			isPreviewInModalWindow = typeof(isPreviewInModalWindow) === "undefined" || isPreviewInModalWindow === true ? true : false;
			/* 调用永中文档转换服务 */
			callYozodcs({
				ruleContext : ruleContext, 
				fileId : fileId,
				previewTargetType : previewTargetType,
				previewWindowSize : previewWindowSize,
				isPreviewInModalWindow : isPreviewInModalWindow
			});
		}
	};
	/**
	 * 新页签方式打开窗体
	 * @param {String} fileUrl 文件id
	 * */
	function newTabPage(fileUrl,ruleContext){
		browser.showModelessDialogExNewTab({
			url : fileUrl
		});
		ReleaseRuleChain(ruleContext);
	}
	/**
	 * 当前页面打开窗体
	 * @param {String} fileUrl 文件id
	 * */
	function currentPage(fileUrl,ruleContext){
		ReleaseRuleChain(ruleContext);
		window.location.href=fileUrl;
	}
	/**
	 * 新窗体打开
	 * */
	function newWindow(params){
		var isPreviewInModalWindow = params.isPreviewInModalWindow,
			fileUrl = params.fileUrl,
			windowState = params.windowState,
			ruleContext = params.ruleContext;
		var info = {
			"title":"附件预览",
			"url":fileUrl
		}
		if(isPreviewInModalWindow){/* 模态下打开 */
			info.windowState = windowState;
			modalByUrlUtil.create(info);
		}else{
			browser.showModelessDialogEx(info);
		}
		ReleaseRuleChain(ruleContext);
	}
	/**
	 * 调用永中文档转换服务
	 * @param {Object} context 规则上下文
	 * @param {String} fId 文件id 
	 * @param {String} openMode 打开方式
	 * */
	function callYozodcs(params){
		var ruleContext = params.ruleContext,
		isPreviewInModalWindow = params.isPreviewInModalWindow,
		previewTargetType = params.previewTargetType,
		previewWindowSize = params.previewWindowSize,
		fileId = params.fileId;
		
		var series = scopeManager.getWindowScope().getSeries();
		if("bootstrap_mobile" == series){
			var successCB = function(data){
				ReleaseRuleChain(ruleContext);
			};
			var errorCB = function(errorMsg){
				HandleException(ruleContext,errorMsg);
			}
			dcs.previewByFileId(fileId,successCB,errorCB);
		}else{
			var successCB = function(data){
				var fileUrl = data.preViewfileUrl;
				switch(previewTargetType){
					case "newTabPage":
						newTabPage(fileUrl,ruleContext);
						break;
					case "currentPage":
						currentPage(fileUrl,ruleContext);
						break;
					default :
						newWindow({
							fileUrl : fileUrl,
							ruleContext : ruleContext,
							isPreviewInModalWindow : isPreviewInModalWindow,
							windowState : previewWindowSize
						});
						break;
				}
			}
			var errorCB = function(errorMsg){
				HandleException(ruleContext,errorMsg);
			}
			dcs.conversionByFileId(fileId,successCB,errorCB);
		}
		SuspendRuleChain(ruleContext);
	}
	/**
	 * 调用pdfjs预览
	 * @param {Object} context 规则上下文
	 * @param {String} fId 文件id 
	 * @param {String} openMode 打开方式
	 * */
	function callPdfjs(params){
		var ruleContext = params.ruleContext,
			previewTargetType = params.previewTargetType,
			previewWindowSize = params.previewWindowSize,
			isPreviewInModalWindow = params.isPreviewInModalWindow,
			waterParamSet = params.waterParamSet,
			fileId = params.fileId;
		/*执行成功回调*/
		var callBackFunc = function(result){
			if(result!=undefined && result.data!=undefined && result.data.isSuccess!=undefined){
				if(result.data.isSuccess == true || result.data.isSuccess === "true"){
					var _filePath = getHost(result.data.filePath,result.data.WebContext);
//					window.open(_filePath);
					switch(previewTargetType){
						case "newWindow":
							newWindow({
								fileUrl : _filePath,
								ruleContext : ruleContext,
								isPreviewInModalWindow : isPreviewInModalWindow,
								windowState : previewWindowSize
							});
							break;
						case "currentPage":
							currentPage(_filePath,ruleContext);
							break;
						default :
							newTabPage(_filePath,ruleContext);
							break;
					}
//					ReleaseRuleChain(ruleContext);
				}else{
					HandleException(ruleContext,result.data.errormsg);
				}
			}else{
				ReleaseRuleChain(ruleContext);
			}
		};
		var scope = scopeManager.getScope();
		var sConfig = {
				"isAsyn": true,
				"componentCode": scope.getComponentCode(),
				"windowCode": scope.getWindowCode(),
				ruleSetCode: "PreviewFile",
				isRuleSetCode:false,
				commitParams: [{
					"paramName": "fileId",
					"paramType": "char",
					"paramValue": fileId
				}],
				afterResponse: callBackFunc
		}
		//增加水印相关参数
		if(!$.isEmptyObject(waterParamSet)){
			var watermarkFileType = "";
			var watermarkType = "picWatermark";
			var watermarkSrcFile = null;
			var watermarkZoom = "100%";
		    var watermarkLocation = "center";
			if(waterParamSet.watermarkSet){
				//watermarkFileType = waterParamSet.watermarkSet[0].watermarkFileType;
				for(var i = 0;i < waterParamSet.watermarkSet.length;i++){
					watermarkFileType += waterParamSet.watermarkSet[i].watermarkFileType + ",";
				}
				watermarkFileType = watermarkFileType.substring(0, (watermarkFileType.length-1));
				watermarkType = waterParamSet.watermarkSet[0].watermarkType;
			}
			if(waterParamSet.picWatermarkStyle){
				watermarkSrcFile = "itop/resources/" + componentCode + "_"+ waterParamSet.picWatermarkStyle[0].watermarkFile;
				watermarkZoom = waterParamSet.picWatermarkStyle[0].watermarkZoom;
				watermarkLocation = waterParamSet.picWatermarkStyle[0].watermarkLocation;
			}
			if(watermarkSrcFile){
				sConfig.commitParams.push({"paramName": "watermarkEnable","paramType": "boolean","paramValue": true});
				sConfig.commitParams.push({"paramName": "watermarkSrcFile","paramType": "char","paramValue": watermarkSrcFile});
				sConfig.commitParams.push({"paramName": "watermarkFileType","paramType": "char","paramValue": watermarkFileType});
				sConfig.commitParams.push({"paramName": "watermarkType","paramType": "char","paramValue": watermarkType});
				sConfig.commitParams.push({"paramName": "watermarkZoom","paramType": "char","paramValue": watermarkZoom.replace("%","")});
				sConfig.commitParams.push({"paramName": "watermarkLocation","paramType": "char","paramValue": watermarkLocation});
			}else{
				sConfig.commitParams.push({"paramName": "watermarkEnable","paramType": "boolean","paramValue": false});
			}	
		}else{
			sConfig.commitParams.push({"paramName": "watermarkEnable","paramType": "boolean","paramValue": false});
		}
		SuspendRuleChain(ruleContext);
		remoteMethodAccessor.invoke(sConfig);
	}
	
	/**
	 * desc 获取地址
	 * @path 文件路径
	 * */
	function getHost(path,webContext){
		var _host =window.location.protocol + "//" + window.location.host;
		_host = _host + (webContext ? webContext : "") + "/itop/pdfjs/web/viewer.html?file=tmpfile/" + path;
		return _host;
	}
	/**
	 * desc 中断规则链
	 * ruleContext 路由上下文
	 * */
	function SuspendRuleChain(ruleContext){
		ruleContext.markRouteExecuteUnAuto();
	}
	/**
	 * desc 释放规则链
	 * ruleContext 路由上下文
	 * */
	function ReleaseRuleChain(ruleContext){
		ruleContext.fireRouteCallback();
	}
	/**
	 * desc 异常处理方法
	 * @ruleContext 规则上下文
	 * @error_msg 提示信息
	 * vjs: 可省略
	 * services: 
	 * 		factory = sandbox.getService("vjs.framework.extension.platform.interface.exception.ExceptionFactory");
	 * */
	function HandleException(ruleContext,error_msg){
		error_msg = ERRORNAME+error_msg;
		var exception = factory.create({"type":factory.TYPES.System, "message":error_msg});
		ruleContext.handleException(exception);
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
	 * desc 执行表达式
	 * experss 表达式
	 * routeContext 路由上下文
	 * vjs:
	 * 		"vjs.framework.extension.platform.services.engine":null,
	 * services:
	 * 		ExpressionContext = sandbox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionContext");
	 * 		engine = sandbox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionEngine");
	 * 
	 * */
	var experssFunc = function(experss,routeContext){
		if(experss==null || experss==""){
			return null;
		}
		var context = new ExpressionContext();
		context.setRouteContext(routeContext);
		var resultValue = formulaUtil.execute({
			"expression": experss,
			"context": context
		});
		return resultValue;
	}
	/**
	 * desc 打印日志
	 * content 需要打印的内容
	 * type 打印的类型，log、warn、error
	 * vjs
	 * 		"vjs.framework.extension.util.log":null
	 * services
	 * 		log = sandbox.getService("vjs.framework.extension.util.log");
	 * */
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
		
		
//		var ajaxCheckUrl = preview_check_url + '&dataId=' + fileId;
//		var previewUrl = preview_url + '&dataId=' + fileId;
//		var title = "附件预览";
//		var width = document.body.clientWidth;
//		var height = document.body.clientHeight;
//		if (width < 800)
//			width = 800;
//		if (height < 600)
//			height = 600;
//		var features = "dialogWidth:" + width + ";dialogHeigth:"
//				+ height + ";help:0";
//		jQuery.ajax({
//			type : "POST",
//			url : ajaxCheckUrl,
//			async : false,
//			data : null,
//			complete : function(respObj, status) {
//				if (status === "success" || status === "notmodified") {
//					var ret = jsonUtil.json2obj(respObj.responseText);
//					var dirExist = ret[0];
//					if(dirExist["success"]){
//						browser.showModalDialogEx({
//							"id" : moduleId,
//							"url" : previewUrl,
//							"title" : title,
//							"width" : width,
//							"height" : height
//						});
//					}else{
//						alert(dirExist["msg"]);
//					}
//				}
//			}
//		});
	
	exports.main = main;

export{    main}