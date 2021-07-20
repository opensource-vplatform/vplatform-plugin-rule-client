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

vds.import("vds.attachment.*", "vds.browser.*", "vds.component.*", "vds.ds.*", "vds.environment.*", "vds.exception.*", "vds.expression.*", "vds.rpc.*", "vds.string.*", "vds.widget.*", "vds.window.*");

// 操作类型：上传、下载、删除、预览
var OP_UPLOAD = '1', OP_DOWNLOAD = '2', OP_DELETE = '3', OP_PREVIEW = '4';
var ERRORNAME = "规则[Attachmentoperation]：";
var main = function (ruleContext) {
	return new Promise(function (resolve, reject) {
		try {
			var inParamObj = ruleContext.getVplatformInput();
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
			var componentCode = vds.component.getCode();
			// 操作类型
			var operation = inParamObj['function'];
			// 预览类型 pdfjs,yozodcs 其他 操作为""
			var reviewScheme = inParamObj["reviewScheme"];
			//水印设置的参数
			var watermarkEnable = inParamObj.watermarkEnable;
			var waterParamSet = {};
			if (watermarkEnable) {
				waterParamSet.watermarkSet = inParamObj.watermarkSet;
				waterParamSet.picWatermarkStyle = inParamObj.picWatermarkStyle;
				waterParamSet.docProtectSet = inParamObj.docProtectSet;//增加文档保护设置
			}
			var moduleId = vds.window.getCode();
			try {
				switch (operation) {
					case OP_UPLOAD:
						doUpload(controls, ruleContext, resolve, reject);
						break;
					case OP_DOWNLOAD:
						doDownload(fileType, fileIdField, oldFileName, moduleId, componentCode, ruleContext, waterParamSet, resolve);
						break;
					case OP_DELETE:
						doDelete(fileIdField, resolve);
						break;
					case OP_PREVIEW:
						doPreview({
							fileIdField: fileIdField,
							moduleId: moduleId,
							fileType: fileType,
							previewTargetType: previewTargetType,
							previewWindowSize: previewWindowSize,
							isPreviewInModalWindow: isPreviewInModalWindow,
							ruleContext: ruleContext,
							reviewScheme: reviewScheme,
							waterParamSet: waterParamSet,
							resolve: resolve,
							reject: reject
						});
					default:
						resolve();
				}
			} catch (e) {
				// 处理IE下console的兼容问题
				if (window.console && console.log)
					console.log(e.message);
				return;
			}
		} catch (ex) {
			reject(ex);
		}
	});
}

/**
 * 上传操作
 */
function doUpload(controls, ruleContext, resolve, reject) {
	if (!controls || controls.length == 0) {
		throw new Error('配置有误：未指定上传控件！');
	}

	var callback = function (fileObj, resultObj) {
		resolve();
	};

	var errorCB = function (errorMessage) {
		if (vds.exception.isException(errorMessage)) {
			reject(errorMessage);
		} else {//应该从源头封装好异常对象
			alert(errorMessage);
		}
	}

	for (var i = 0; i < controls.length; i++) {
		/* 控件编码 */
		var widgetId = controls[i].componentControlCode;
		var fileUploaded = vds.widget.execute(widgetId, "getFileUploaded");
		if (!fileUploaded) {
			fileUploaded = function () { }
		}
		/* 单个文件上传后执行的方法 */
		var singleFileUploadedFunc = ruleContext.genAsynCallback(fileUploaded);
		vds.widget.execute(widgetId, "upload", [callback, { 'singleFileUploaded': singleFileUploadedFunc, 'errorCB': errorCB }]);
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
		throw new Error('配置有误：文件字段需要配置为表名.字段名形式！fieldName=' + fileIdField);
	return parts[0];
}

/**
 * 获取第一个选中记录的文件Id
 */
function getFirstSelectedFileId(fileIdField) {
	var dataSourceName = getDataSourceName(fileIdField);
	var datasource = vds.ds.lookup(dataSourceName);
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
	var widgetCodes = vds.widget.getWidgetCodes(dataSourceName);
	var chooseMode = 0;
	if (widgetCodes && widgetCodes.length > 0) {
		for (var j = 0, len = widgetCodes.length; j < len; j++) {
			var widget = vds.widget.getProperty(widgetCodes[j], "widgetObj");
			if (widget && widget.type == "JGDataGrid") {
				chooseMode = widget.ChooseMode;
			}
		}
	}
	var rows = [];
	if (chooseMode == 0) {
		var datasource = vds.ds.lookup(dataSourceName);
		var record = datasource.getCurrentRecord();
		if (record) {
			rows.push(record);
		}
	} else {
		var datasource = vds.ds.lookup(dataSourceName);
		var rs = datasource.getSelectedRecords();
		rows = rs.toArray();
	}
	if (!rows || rows.length == 0) {
		throw new Error('请选择要操作的文件！');
	}

	var fileIds = [];
	for (var i = 0; i < rows.length; i++) {
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
	var datasource = vds.ds.lookup(dataSourceName);
	var rs = datasource.getSelectedRecords();
	var rows = rs.toArray();
	if (!rows || rows.length == 0) {
		throw new Error('请选择要操作的文件！');
	}
	return rows;
}

var getFieldName = function (fieldName) {
	if (fieldName != null && fieldName.indexOf(".") > 0)
		return fieldName.split(".")[1];
	return fieldName;
};

/**
 * 执行下载操作(下载选中的文件,分为static/dynamic两种类型)
 */
function doDownload(fileType, fileIdField, oldFileName, moduleId, componentCode, ruleContext, waterParamSet, resolve) {
	var download_url = 'module-operation!executeOperation?moduleId=' + moduleId + '&operation=FileDown';
	var token = {};
	var fileName = "";
	if (fileType == 'expression') {
		var fileid = vds.expression.execute(fileIdField, { "ruleContext": ruleContext });
		if (oldFileName != null && oldFileName != "") {
			fileName = vds.expression.execute(oldFileName, { "ruleContext": ruleContext });
		}
		token = {
			data: {
				'isMulti': false,
				'dataId': fileid,
				'oldFileName': fileName
			}
		};
	} else if (fileType == 'static') {
		var filePath = "itop/resources/" + componentCode + "_" + fileIdField;
		token = {
			data: {
				'staticFilePath': filePath,
				'oldFileName': oldFileName
			}
		};
	} else {
		var fileIds = getSelectedFileIds(fileIdField);
		if (fileIds.length == 0) {
			throw new Error('文件不存在！');
		}
		if (oldFileName != null && oldFileName != "") {
			fileName = vds.expression.execute(oldFileName, { "ruleContext": ruleContext });
		}
		token = {
			data: {
				'isMulti': (fileIds.length > 1),
				'dataId': (fileIds.length > 1) ? fileIds : fileIds[0],
				'oldFileName': fileName
			}
		};
	}
	//处理水印参数
	console.log(waterParamSet);
	if (!$.isEmptyObject(waterParamSet)) {
		var watermarkFileType = "";
		//var watermarkType = "picWatermark";
		var watermarkType = "";//根据水印类型(无/图片水印)，确定是否加水印
		var watermarkFileProtect = "";//文档保护类型（无/限制编辑）
		var docPassWord = "";//文档保护密码
		var watermarkSrcFile = null;
		var watermarkZoom = "100%";
		var watermarkLocation = "center";
		if (waterParamSet.watermarkSet) {
			//文件类型
			for (var i = 0; i < waterParamSet.watermarkSet.length; i++) {
				watermarkFileType += waterParamSet.watermarkSet[i].watermarkFileType + ",";
				var watermarkTypeStr = waterParamSet.watermarkSet[i].watermarkType;
				if (watermarkTypeStr != "") {
					watermarkType += waterParamSet.watermarkSet[i].watermarkType + ",";
				} else {
					watermarkType += "none" + ",";
				}
				var watermarkFileProtectStr = waterParamSet.watermarkSet[i].watermarkFileProtect;
				if (watermarkFileProtectStr != "") {
					watermarkFileProtect += waterParamSet.watermarkSet[i].watermarkFileProtect + ",";
				} else {
					watermarkFileProtect += "none" + ",";
				}
			}
			watermarkFileType = watermarkFileType.substring(0, (watermarkFileType.length - 1));
			watermarkType = watermarkType.substring(0, (watermarkType.length - 1));
			watermarkFileProtect = watermarkFileProtect.substring(0, (watermarkFileProtect.length - 1));
		}
		if (waterParamSet.picWatermarkStyle) {
			watermarkSrcFile = "itop/resources/" + componentCode + "_" + waterParamSet.picWatermarkStyle[0].watermarkFile;
			watermarkZoom = waterParamSet.picWatermarkStyle[0].watermarkZoom;
			watermarkLocation = waterParamSet.picWatermarkStyle[0].watermarkLocation;
		}
		if (waterParamSet.docProtectSet) {
			docPassWord = waterParamSet.docProtectSet[0].docPassWord;
			if (docPassWord != "") {
				docPassWord = vds.expression.execute(docPassWord, { "ruleContext": ruleContext });
			}
		}
		if (watermarkSrcFile) {
			token.data.watermarkEnable = true;
			token.data.watermarkSrcFile = watermarkSrcFile;
			token.data.watermarkFileType = watermarkFileType;
			token.data.watermarkType = watermarkType;
			token.data.watermarkFileProtect = watermarkFileProtect;
			token.data.watermarkZoom = watermarkZoom.replace("%", "");
			token.data.watermarkLocation = watermarkLocation;
			token.data.docPassWord = docPassWord;//文档保护密码
		} else {
			token.data.watermarkEnable = true;
			token.data.docPassWord = docPassWord;//文档保护密码
		}
	} else {
		token.data.watermarkEnable = false;
	}
	var prefix = download_url.indexOf('?') == -1 ? '?' : '&';
	var url = download_url + prefix + 'token=' + encodeURIComponent(vds.string.toJson(token));

	var mIsApp = isApp();
	var mIsIOS = isIOS();
	var mIsAndroid = isAndroid();
	if (mIsApp) {
		url = VPlatformPatch.getServiceAddr() + "/" + url;
		if (mIsIOS) {
			alert("文件下载不支持iOS系统");
		} else if (mIsAndroid) {
			if (cordova.plugins.system.config.systemDownload) {
				cordova.plugins.system.config.systemDownload(url);
			} else {
				alert("当前客户端不支持文件下载，请升级客户端。")
			}

		}
	} else {
		if (mIsIOS) {
			alert("文件下载不支持iOS系统");
		} else {
			createIFrame("file_down_iframe", url);
		}
	}
	resolve();
}

function isAndroid() {
	var ua = navigator.userAgent;
	if (ua.match(/Android/i) == "Android") {
		return true;
	} else {
		return false;
	}
}

function isIOS() {
	return /(iPhone|iPad|iPod|iOS)/i.test(navigator.userAgent);
}

function isApp() {
	return navigator.userAgent.match(/ydgApp/i) == "ydgApp";
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
function doDelete(fileIdField, resolve) {
	var delRecords = getSelectedRecords(fileIdField);
	if (delRecords == null || delRecords.length == 0)
		return;
	for (var i = 0; i < delRecords.length; i++) {
		delRecords[i].set(getFieldName(fileIdField), null);
	}
	var dsName = getDataSourceName(fileIdField)
	var ds = vds.ds.lookup(dsName);
	ds.updateRecords(delRecords);
	resolve();
}

/**
 * 预览操作(选中的第一个文件)
 */
function doPreview(params) {
	var fileIdField = params.fileIdField,
		moduleId = params.moduleId,
		fileType = params.fileType,
		ruleContext = params.ruleContext,
		reviewScheme = params.reviewScheme,
		previewTargetType = params.previewTargetType,
		previewWindowSize = params.previewWindowSize,
		isPreviewInModalWindow = params.isPreviewInModalWindow,
		waterParamSet = params.waterParamSet,
		resolve = params.resolve,
		reject = params.reject;
	var fileId = null;
	if (fileType == 'expression') {
		fileId = vds.expression.execute(fileIdField, { "ruleContext": ruleContext });
	} else {
		fileId = getFirstSelectedFileId(fileIdField);
	}
	var title = "附件预览";
	var width = document.documentElement.clientWidth;
	var height = document.documentElement.clientHeight;
	width = width / 2;
	height = height / 2;
	if (!reviewScheme || reviewScheme == "pdfjs" || reviewScheme == "") {
		previewTargetType = typeof (previewTargetType) === "undefined" ? "newTabPage" : previewTargetType;
		/* 调用pdfjs服务 */
		callPdfjs({
			ruleContext: ruleContext,
			fileId: fileId,
			previewTargetType: previewTargetType,
			previewWindowSize: previewWindowSize,
			waterParamSet: waterParamSet,
			isPreviewInModalWindow: isPreviewInModalWindow,
			resolve: resolve,
			reject: reject
		});
	} else if (reviewScheme == "yozodcs") {
		isPreviewInModalWindow = typeof (isPreviewInModalWindow) === "undefined" || isPreviewInModalWindow === true ? true : false;
		/* 调用永中文档转换服务 */
		callYozodcs({
			ruleContext: ruleContext,
			fileId: fileId,
			previewTargetType: previewTargetType,
			previewWindowSize: previewWindowSize,
			isPreviewInModalWindow: isPreviewInModalWindow,
			resolve: resolve,
			reject: reject
		});
	}
};

/**
 * 新页签方式打开窗体
 * @param {String} fileUrl 文件id
 * */
function newTabPage(fileUrl) {
	vds.browser.newTab(fileUrl);
}

/**
 * 当前页面打开窗体
 * @param {String} fileUrl 文件id
 * */
function currentPage(fileUrl) {
	window.location.href = fileUrl;
}

/**
 * 新窗体打开
 * */
function newWindow(params) {
	var isPreviewInModalWindow = params.isPreviewInModalWindow;
	var fileUrl = params.fileUrl;
	if (isPreviewInModalWindow) {/* 模态下打开 */
		var isMaximize = false;
		var windowState = params.windowState;
		if (windowState && windowState == "Maximized") {
			isMaximize = true;
		}
		vds.browser.dialog(fileUrl, { "title": "附件预览", "maximize": isMaximize })
	} else {
		vds.browser.newTab(fileUrl, { "title": "附件预览" });
	}
}

/**
 * 调用永中文档转换服务
 * 
 * */
function callYozodcs(params) {
	var ruleContext = params.ruleContext,
		isPreviewInModalWindow = params.isPreviewInModalWindow,
		previewTargetType = params.previewTargetType,
		previewWindowSize = params.previewWindowSize,
		fileId = params.fileId,
		resolve = params.resolve,
		reject = params.reject;

	if (vds.environment.isMobileWindow()) {
		var successCB = function (data) {
		};
		var errorCB = function (errorMsg) {
			HandleException(errorMsg, reject);
		}
		var promise = vds.attachment.preview(fileId);
		promise.then(successCB).catch(errorCB);
	} else {
		var successCB = function (data) {
			var fileUrl = data.preViewfileUrl;
			switch (previewTargetType) {
				case "newTabPage":
					newTabPage(fileUrl);
					break;
				case "currentPage":
					currentPage(fileUrl);
					break;
				default:
					newWindow({
						fileUrl: fileUrl,
						ruleContext: ruleContext,
						isPreviewInModalWindow: isPreviewInModalWindow,
						windowState: previewWindowSize
					});
					break;
			}
		}
		var errorCB = function (errorMsg) {
			HandleException(errorMsg, reject);
		}
		var promise = vds.attachment.convert(fileId);
		promise.then(successCB).catch(errorCB);
	}
	resolve();
}

/**
 * 调用pdfjs预览
 * 
 * */
function callPdfjs(params) {
	var ruleContext = params.ruleContext,
		previewTargetType = params.previewTargetType,
		previewWindowSize = params.previewWindowSize,
		isPreviewInModalWindow = params.isPreviewInModalWindow,
		waterParamSet = params.waterParamSet,
		fileId = params.fileId,
		resolve = params.resolve,
		reject = params.reject;
	/*执行成功回调*/
	var callBackFunc = function (result) {
		if (result != undefined && result.data != undefined && result.data.isSuccess != undefined) {
			if (result.data.isSuccess == true || result.data.isSuccess === "true") {
				var _filePath = getHost(result.data.filePath, result.data.WebContext);
				switch (previewTargetType) {
					case "newWindow":
						newWindow({
							fileUrl: _filePath,
							ruleContext: ruleContext,
							isPreviewInModalWindow: isPreviewInModalWindow,
							windowState: previewWindowSize
						});
						break;
					case "currentPage":
						currentPage(_filePath);
						break;
					default:
						newTabPage(_filePath);
						break;
				}
			} else {
				HandleException(result.data.errormsg, reject);
			}
		}
		resolve();
	};

	var sConfig = {
		"command": "PreviewFile",
		"datas": [{
			"code": "fileId",
			"type": "char",
			"value": fileId
		}],
		"params": { "isAsyn": true, isRuleSetCode: false }
	}
	//增加水印相关参数
	if (!$.isEmptyObject(waterParamSet)) {
		var watermarkFileType = "";
		var watermarkType = "picWatermark";
		var watermarkSrcFile = null;
		var watermarkZoom = "100%";
		var watermarkLocation = "center";
		if (waterParamSet.watermarkSet) {
			for (var i = 0; i < waterParamSet.watermarkSet.length; i++) {
				watermarkFileType += waterParamSet.watermarkSet[i].watermarkFileType + ",";
			}
			watermarkFileType = watermarkFileType.substring(0, (watermarkFileType.length - 1));
			watermarkType = waterParamSet.watermarkSet[0].watermarkType;
		}
		if (waterParamSet.picWatermarkStyle) {
			watermarkSrcFile = "itop/resources/" + componentCode + "_" + waterParamSet.picWatermarkStyle[0].watermarkFile;
			watermarkZoom = waterParamSet.picWatermarkStyle[0].watermarkZoom;
			watermarkLocation = waterParamSet.picWatermarkStyle[0].watermarkLocation;
		}
		if (watermarkSrcFile) {
			sConfig.datas.push({ "code": "watermarkEnable", "type": "boolean", "value": true });
			sConfig.datas.push({ "code": "watermarkSrcFile", "type": "char", "value": watermarkSrcFile });
			sConfig.datas.push({ "code": "watermarkFileType", "type": "char", "value": watermarkFileType });
			sConfig.datas.push({ "code": "watermarkType", "type": "char", "value": watermarkType });
			sConfig.datas.push({ "code": "watermarkZoom", "type": "char", "value": watermarkZoom.replace("%", "") });
			sConfig.datas.push({ "code": "watermarkLocation", "type": "char", "value": watermarkLocation });
		} else {
			sConfig.datas.push({ "code": "watermarkEnable", "type": "boolean", "value": false });
		}
	} else {
		sConfig.datas.push({ "code": "watermarkEnable", "type": "boolean", "value": false });
	}

	var promise = vds.rpc.callCommand(sConfig.command, sConfig.datas, sConfig.params);
	promise.then(callBackFunc).catch(reject);
}

/**
 * desc 获取地址
 * @path 文件路径
 * */
function getHost(path, webContext) {
	var _host = window.location.protocol + "//" + window.location.host;
	_host = _host + (webContext ? webContext : "") + "/itop/pdfjs/web/viewer.html?file=tmpfile/" + path;
	return _host;
}

/**
 * 异常处理方法
 * @ruleContext 规则上下文
 * @error_msg 提示信息
 * */
function HandleException(error_msg, reject) {
	error_msg = ERRORNAME + error_msg;
	var exception = new vds.exception.newSystemException(error_msg);
	reject(exception);
}

export { main }