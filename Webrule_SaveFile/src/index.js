/**
 *
 * 保存图片
 */
//vds.import("vds.");
/**
 * 规则入口
 */
var main = function (ruleContext) {
	return new Promise(function (resolve, reject) {
		try {
			var inParamObj = ruleContext.getVplatformInput();
			if (!inParamObj) { //建议兼容
				inParamObj = "";
			}
			// 获取规则链路由上下文,终止执行后续规则
			routeContext = ruleContext.getRouteContext();
			inParamObj.count = inParamObj.count ? experssFunc(inParamObj.count) : inParamObj.count;
			inParamObj.isFront = inParamObj.isFront ? experssFunc(inParamObj.isFront) : inParamObj.isFront;
			//图片质量
			var quatity = experssFunc(inParamObj.quatity);
			if (quatity == null || quatity == "") {
				quatity = 50;
			} else {
				//转换成数字
				quatity = getNum(quatity);
				if (quatity < 0 || quatity > 100) {
					HandleException("图片质量不能小于0且不能大于100");
				}
			}
			inParamObj.quatity = quatity;
			inParamObj.saveToAlbum = inParamObj.saveToAlbum ? experssFunc(inParamObj.saveToAlbum) : inParamObj.saveToAlbum;
			var saveTarget = inParamObj.saveTarget;
			if (saveTarget == "app") {
				save2Native(routeContext, ruleContext, inParamObj, resolve, reject);
			} else {
				upload2Server(routeContext, ruleContext, inParamObj, resolve, reject);
			}
			resolve();
		} catch (err) {
			reject(err);
		}
	});
}
var ExpressionContext, engine, manager, DBFactory, jsonUtil, log, factory;
var CameraService, FileTransferService, ImagePickerService, routeContext, widgetDatasource, scopeManager, ImageService, sandbox, progressbar;
var ERRORNAME = "规则[SaveFile]：";
var mathUtil;
//初始化vjs模块，如果规则逻辑需要引用相关vjs服务，则初始化相关vjs模块；如果不需要初始化逻辑可以为空
exports.initModule = function (sBox) {
	//sBox：前台vjs的沙箱（容器/上下文），可以用它根据vjs名称，获取到相应vjs服务
	sandbox = sBox;
	ExpressionContext = sandbox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionContext");
	engine = sandbox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionEngine");
	manager = sandbox.getService("vjs.framework.extension.platform.services.model.manager.datasource.DatasourceManager");
	DBFactory = sandbox.getService("vjs.framework.extension.platform.interface.model.datasource.DatasourceFactory");
	mathUtil = sandbox.getService("vjs.framework.extension.util.Math");
	jsonUtil = sandbox.getService("vjs.framework.extension.util.JsonUtil");
	log = sandbox.getService("vjs.framework.extension.util.log");
	CameraService = sandbox.getService("vjs.framework.extension.platform.services.native.mobile.Camera");
	ImagePickerService = sandbox.getService("vjs.framework.extension.platform.services.native.mobile.ImagePicker");
	widgetDatasource = sandbox.getService("vjs.framework.extension.platform.services.view.widget.common.logic.datasource.WidgetDatasource");
	factory = sandbox.getService("vjs.framework.extension.platform.interface.exception.ExceptionFactory");
	scopeManager = sandbox.getService("vjs.framework.extension.platform.interface.scope.ScopeManager");
	progressbar = sandbox.getService("vjs.framework.extension.ui.common.plugin.services.progressbar.ProgressBarUtil");
	FileTransferService = sandbox.getService("vjs.framework.extension.platform.services.native.mobile.FileTransfer");
}
var upload2Server = function (routeContext, ruleContext, inParamObj, resolve, reject) {
	var type = inParamObj.sourceType;
	if (type == "filePath") {
		uploadFromFilePath(routeContext, ruleContext, inParamObj, resolve, reject);
	} else {
		uploadFromUserSelect(routeContext, ruleContext, inParamObj, resolve, reject);
	}
}

var uploadFromFilePath = function (routeContext, ruleContext, inParamObj, resolve, reject) {
	//1.从实体中获取本地文件路径
	var sEntityCode = inParamObj.sourceEntityCode;
	var sFieldCode = inParamObj.sourceFieldCode;
	var sDataSource = GetDataSource(sEntityCode, routeContext);
	if (!sDataSource) {
		reject(vds.exception.newConfigException("请检查实体" + sEntityCode + "是否存在"));
	}
	var datas = sDataSource.getAllRecords().datas;//???
	if (datas.length > 0) {
		var filePaths = [];
		for (var i = 0; i < datas.length; i++) {
			var data = datas[i];
			var fPath = data[sFieldCode];
			if (fPath && fPath.indexOf("file://") != -1) {
				fPath = fPath.substring(fPath.indexOf("file://") + 7, fPath.length);
				filePaths.push(fPath);
			}
		}
		var scopeId = scopeManager.getCurrentScopeId();
		var uploadSuccess = function (results) {
			if (undefined != scopeId) scopeManager.openScope(scopeId);
			if (results && undefined != results.success && (results.success == false || results.success == "false")) {
				HandleException(ruleContext, "图片上传规则：上传图片不成功");
				setBusinessRuleResult(ruleContext, false);
			} else {
				var resultEntityCode = inParamObj.resultEntityCode;
				var resultFieldCode = inParamObj.resultFieldCode;
				var rDataSource = GetDataSource(resultEntityCode, routeContext);
				if (!rDataSource) {
					HandleException("请检查实体" + resultEntityCode + "是否存在");
				}
				var fileIds = results;
				if (fileIds) {
					var insertRecords = [];
					for (var i = 0; i < fileIds.length; i++) {
						var fileId = fileIds[i];
						var emptyRecord = rDataSource.createRecord();
						emptyRecord.set(resultFieldCode, fileId);
						insertRecords.push(emptyRecord);
					}
					rDataSource.insertRecords({
						"records": insertRecords,
						"position": 3
					});
				}
				setBusinessRuleResult(ruleContext, true);
			}
			scopeManager.closeScope();
			ruleContext.fireRouteCallback();
		}
		FileTransferService.filetransferUpload(filePaths, uploadSuccess);
	} else {
		setBusinessRuleResult(ruleContext, true);
		ruleContext.fireRouteCallback();
	}
}

var uploadFromUserSelect = function (routeContext, ruleContext, inParamObj, resolve, reject) {
	var type = inParamObj.sourceType;
	var dataSource = GetDataSource(inParamObj.resultEntityCode, routeContext);
	if (!dataSource) {
		HandleException("请检查实体" + entityCode + "是否存在");
	}
	var fieldCode = inParamObj.resultFieldCode; //字段编码

	var zd = $("#md-bg-imgupload");
	var nr = $("#main-imgupload");
	if (zd != undefined && zd.length > 0 && nr != undefined && nr.length > 0) {
		$("body #main-imgupload li").unbind("click");
	} else {
		if (zd != undefined && zd.length > 0) zd.remove();
		if (nr != undefined && nr.length > 0) nr.remove();
		//遮罩以及弹出的内容
		var ruleDialogHTML = '<div id="md-bg-imgupload" class="mobileDialog-bg" style="opacity: 1;background-color: rgba(0,0,0,0.4)"></div><div id="main-imgupload" class="imageUploadDialog-main"><div class="imageUploadDialog-bg"><li id="takePhoto" class="imageUploadDialog-btns" style="border-radius: 12px 12px 0 0;" data-value="picture">拍照</li><li id="imagePicker" class="imageUploadDialog-btns" style="border-radius: 0 0 12px 12px;" data-value="album">从手机相册选择</li></div><div class="imageUploadDialog-bg"><li class="imageUploadDialog-btns" data-value="cancle" style="margin-top: 8px;border-radius: 12px;">取消</li></div></div>';
		$("body").append(ruleDialogHTML);
	}
	var scopeId = scopeManager.getCurrentScopeId();
	$("body #md-bg-imgupload").on("click", removeDailog);
	$("body #main-imgupload li").on("click", function () {
		var valueCode = $(this).attr("data-value");
		//成功后回调
		removeDailog();
		var SuncceccCallBack = function (imagePath) {
			if (undefined != scopeId) scopeManager.openScope(scopeId);
			if (imagePath && imagePath.length > 0) {
				//上传后的回调,设置规则返回值
				var uploadSuccess = function (results) {
					if (results && undefined != results.success && (results.success == false || results.success == "false")) {
						HandleException(ruleContext, "图片上传规则：上传图片不成功");
						setBusinessRuleResult(ruleContext, false);
					} else {
						var fileIds = results;
						if (fileIds) {
							var insertRecords = [];
							for (var i = 0; i < fileIds.length; i++) {
								var fileId = fileIds[i];
								var emptyRecord = dataSource.createRecord();
								emptyRecord.set(fieldCode, fileId);
								insertRecords.push(emptyRecord);
							}
							dataSource.insertRecords({
								"records": insertRecords,
								"position": 3
							});
						}
						setBusinessRuleResult(ruleContext, true);
					}
					scopeManager.closeScope();
					ruleContext.fireRouteCallback();
				}
				if (valueCode == "picture") {
					imagePath = StringToArray(imagePath);
				}
				FileTransferService.filetransferUpload(imagePath, uploadSuccess);
			} else {
				setBusinessRuleResult(ruleContext, false);
				ruleContext.fireRouteCallback();
			}
		}
		//失败后回调
		var FailCallBack = function (errorMsg) {
			setBusinessRuleResult(ruleContext, false);
			removeDailog();
			ruleContext.fireRouteCallback();
		}
		var options = {};
		options["quality"] = inParamObj.quatity;
		if (valueCode == "cancle") {
			removeDailog();
			setBusinessRuleResult(ruleContext, false);
			ruleContext.fireRouteCallback();
			return;
		} else if (valueCode == "picture") {
			options.destinationType = Camera.DestinationType.FILE_URI;
			options.sourceType = Camera.PictureSourceType.CAMERA;
			options.encodingType = Camera.EncodingType.JPEG;
			options.mediaType = Camera.MediaType.PICTURE;
			options.allowEdit = false;
			options.correctOrientation = true;
			var isFront = inParamObj.isFront == true ? Camera.Direction.FRONT : Camera.Direction.BACK;
			options.cameraDirection = isFront;
			options.saveToPhotoAlbum = inParamObj.saveToAlbum;
			CameraService.getPicture(SuncceccCallBack, FailCallBack, options);
		} else if (valueCode == "album") {
			/*设置相册最大选择数量*/
			options["maximumImagesCount"] = inParamObj.count;
			ImagePickerService.getPicture(SuncceccCallBack, FailCallBack, options);
		} else {
			HandleException(ruleContext, "图片上传规则暂时不支持这种类型：" + valueCode);
			removeDailog();
			setBusinessRuleResult(ruleContext, false);
			ruleContext.fireRouteCallback();
			return;
		}
	});
	showDailog(type);
}

var save2Native = function (routeContext, ruleContext, inParamObj, resolve, reject) {
	var type = inParamObj.sourceType;
	var dataSource = GetDataSource(inParamObj.resultEntityCode, routeContext);
	if (!dataSource) {
		HandleException("请检查实体" + entityCode + "是否存在");
	}
	var fieldCode = inParamObj.resultFieldCode; //字段编码

	var zd = $("#md-bg-imgupload");
	var nr = $("#main-imgupload");
	if (zd != undefined && zd.length > 0 && nr != undefined && nr.length > 0) {
		$("body #main-imgupload li").unbind("click");
	} else {
		if (zd != undefined && zd.length > 0) zd.remove();
		if (nr != undefined && nr.length > 0) nr.remove();
		//遮罩以及弹出的内容
		var ruleDialogHTML = '<div id="md-bg-imgupload" class="mobileDialog-bg" style="opacity: 1;background-color: rgba(0,0,0,0.4)"></div><div id="main-imgupload" class="imageUploadDialog-main"><div class="imageUploadDialog-bg"><li id="takePhoto" class="imageUploadDialog-btns" style="border-radius: 12px 12px 0 0;" data-value="picture">拍照</li><li id="imagePicker" class="imageUploadDialog-btns" style="border-radius: 0 0 12px 12px;" data-value="album">从手机相册选择</li></div><div class="imageUploadDialog-bg"><li class="imageUploadDialog-btns" data-value="cancle" style="margin-top: 8px;border-radius: 12px;">取消</li></div></div>';
		$("body").append(ruleDialogHTML);
	}
	var scopeId = scopeManager.getCurrentScopeId();
	$("body #md-bg-imgupload").on("click", removeDailog);
	$("body #main-imgupload li").on("click", function () {
		removeDailog();
		var valueCode = $(this).attr("data-value");
		//成功后回调
		var SuncceccCallBack = function (imagePath) {
			if (undefined != scopeId) scopeManager.openScope(scopeId);
			if (imagePath && imagePath.length > 0) {
				//上传后的回调,设置规则返回值
				var uploadSuccess = function (results) {
					if (results && undefined != results.success && (results.success == false || results.success == "false")) {
						HandleException(ruleContext, "图片上传规则：上传图片不成功");
						setBusinessRuleResult(ruleContext, false);
					} else {
						var fileIds = results;
						if (fileIds) {
							var insertRecords = [];
							for (var i = 0; i < fileIds.length; i++) {
								var fileId = fileIds[i];
								var emptyRecord = dataSource.createRecord();
								emptyRecord.set(fieldCode, fileId);
								insertRecords.push(emptyRecord);
							}
							dataSource.insertRecords({
								"records": insertRecords,
								"position": 3
							});
						}
						setBusinessRuleResult(ruleContext, true);
					}
					scopeManager.closeScope();
					ruleContext.fireRouteCallback();
				}
				if (valueCode == "picture") {
					imagePath = StringToArray(imagePath);
				}
				save2App(imagePath, uploadSuccess);
			} else {
				setBusinessRuleResult(ruleContext, false);
				ruleContext.fireRouteCallback();
			}
		}
		//失败后回调
		var FailCallBack = function (errorMsg) {
			setBusinessRuleResult(ruleContext, false);
			removeDailog();
			ruleContext.fireRouteCallback();
		}
		var options = {};
		options["quality"] = inParamObj.quatity;
		if (valueCode == "cancle") {
			removeDailog();
			setBusinessRuleResult(ruleContext, false);
			ruleContext.fireRouteCallback();
			return;
		} else if (valueCode == "picture") {
			options.destinationType = Camera.DestinationType.FILE_URI;
			options.sourceType = Camera.PictureSourceType.CAMERA;
			options.encodingType = Camera.EncodingType.JPEG;
			options.mediaType = Camera.MediaType.PICTURE;
			var isFront = inParamObj.isFront == true ? Camera.Direction.FRONT : Camera.Direction.BACK;
			options.cameraDirection = isFront;
			options.allowEdit = false;
			options.correctOrientation = true;
			options.saveToPhotoAlbum = inParamObj.saveToAlbum;
			CameraService.getPicture(SuncceccCallBack, FailCallBack, options);
		} else if (valueCode == "album") {
			/*设置相册最大选择数量*/
			options["maximumImagesCount"] = inParamObj.count;
			ImagePickerService.getPicture(SuncceccCallBack, FailCallBack, options);
		} else {
			HandleException(ruleContext, "图片上传规则暂时不支持这种类型：" + valueCode);
			removeDailog();
			setBusinessRuleResult(ruleContext, false);
			ruleContext.fireRouteCallback();
			return;
		}
	});
	showDailog(type);
}

var getFileName = function (filePath) {
	var fileName = filePath.substring(filePath.lastIndexOf("/") + 1, filePath.length);
	return fileName;
}

var save2App = function (sourceFilePath, callback) {
	var fileIndex = 0;
	progressbar.showProgress("正在保存图片...");
	var results = [];
	for (var i = 0; i < sourceFilePath.length; i++) {
		var fPath = sourceFilePath[i];
		var fileName = getFileName(fPath);
		if (window.device && window.device.platform == "iOS") {
			fileURL = cordova.file.documentsDirectory + "appimage/" + fileName;
		} else {
			fileURL = cordova.file.dataDirectory + "appimage/" + fileName;
		}
		var fileTransfer = new FileTransfer();
		var uri = encodeURI(fPath);
		fileTransfer.download(
			uri,
			fileURL,
			function (entry) {
				results.push(entry.nativeURL);
				fileIndex++;
				if (fileIndex == sourceFilePath.length) {
					progressbar.hideProgress();
					callback(results);
				}
			},
			function (error) {
				progressbar.hideProgress();
				alert("保存失败");
				callback(error);
			},
			false, {
				headers: {
					"Authorization": "Basic dGVzdHVzZXJuYW1lOnRlc3RwYXNzd29yZA=="
				}
			}
		);
	}
}

var StringToArray = function (str) {
	var tmpvar = [];
	tmpvar[0] = str;
	return tmpvar;
}
var removeDailog = function () {
	$("body").find("#md-bg-imgupload").fadeOut(300);
	$("body").find("#main-imgupload").css("transform", "translateY(120%)");
}
var showDailog = function (type) {
	if (type == "album") {
		$("#takePhoto").hide();
		$("#imagePicker").show();
	} else if (type == "camera") {
		$("#takePhoto").show();
		$("#imagePicker").hide();
	} else if (type == "albumAndCamera") {
		$("#takePhoto").show();
		$("#imagePicker").show();
	}
	$("body").find("#md-bg-imgupload").fadeIn(300);
	$("body").find("#main-imgupload").css("transform", "translateY(0)");
}
/**
 * desc 异常处理方法
 * @ruleContext 规则上下文
 * @error_msg 提示信息
 * vjs: 可省略
 * services: 
 * 		factory = sandbox.getService("vjs.framework.extension.platform.interface.exception.ExceptionFactory");
 * */
function HandleException(ruleContext, error_msg) {
	error_msg = ERRORNAME + error_msg;
	var exception = factory.create({
		"type": factory.TYPES.Business,
		"message": error_msg
	});
	ruleContext.handleException(exception);
}
/**
 * desc 非回调中抛异常
 * @ruleContext 规则上下文
 * @error_msg 提示信息
 * vjs: 可省略
 * services: 
 * 		factory = sandbox.getService("vjs.framework.extension.platform.interface.exception.ExceptionFactory");
 * */
function HandleException(error_msg) {
	error_msg = ERRORNAME + error_msg;
	var exception = factory.create({
		"type": factory.TYPES.Business,
		"message": error_msg
	});
	throw exception;
}
/**
 * @desc 获取数字类型的值,不是数字会抛异常
 * @param sourceValue 来源值(String|Number)
 * @param paramName 参数名称
 * @returns targetValue 数字类型的值(Number)
 * @vjs
 * 		"vjs.framework.extension.util.math":null
 * @service
 * 		mathUtil = sandbox.getService("vjs.framework.extension.util.Math");
 * */
function getNum(sourceValue, paramName) {
	if (sourceValue == null || sourceValue == "") {
		return 0;
	}
	if (!mathUtil.isNum(sourceValue) || Number(sourceValue) == "NaN") {
		HandleException(paramName + "不是数字类型");
	}
	return Number(sourceValue);
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
function OutPutLog(content, type) {
	if (log == null) return;
	/*打印log类型的日志*/
	if (type == "log") {
		log.log(ERRORNAME + content);
		return;
	}
	/*打印warn类型的日志*/
	if (type == "warn") {
		log.warn(ERRORNAME + content);
		return;
	}
	/*打印error类型的日志*/
	if (type == "error") {
		log.error(ERRORNAME + content);
		return;
	}
}

/**
 * desc 执行表达式
 * experss 表达式
 * ruleContext 规则上下文
 * vjs:
 * 		"vjs.framework.extension.platform.services.engine":null,
 * services:
 * 		ExpressionContext = sandbox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionContext");
 * 		engine = sandbox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionEngine");
 * 
 * */
function experssFunc(experss, ruleContext) {
	if (experss == null || experss == "") {
		return null;
	}
	var resultValue = engine.execute(experss, {
		"ruleContext": ruleContext
	});
	return resultValue;
}

//获取实体对象
function GetDataSource(ds, routeContext) {
	var dsName = ds;
	var datasource = null;
	if (DBFactory.isDatasource(dsName)) {
		datasource = dsName;
	} else {
		var context = new ExpressionContext();
		context.setRouteContext(routeContext);
		if (dsName.indexOf(".") == -1 && dsName.indexOf("@") == -1) {
			datasource = manager.lookup({
				"datasourceName": dsName
			});
		} else {
			datasource = engine.execute({
				"expression": dsName,
				"context": context
			});
		}
	}
	//			if(!datasource) throw new Error("规则[图片上传]找不到配置的实体！");
	return datasource;
}
/**
 * 设置业务返回结果
 */
function setBusinessRuleResult(ruleContext, result) {
	if (ruleContext.setBusinessRuleResult) {
		ruleContext.setBusinessRuleResult({
			isSuccess: result
		});
	}
}


exports.main = main;

export {
	main
}