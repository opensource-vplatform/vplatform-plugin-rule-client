/**
 *
 * 保存图片
 */
vds.import("vds.exception.*","vds.app.*","vds.progress.*","vds.object.*","vds.expression.*","vds.ds.*");
/**
 * 规则入口
 */
var main = function (ruleContext) {
	return new Promise(function (resolve, reject) {
		try {
			var inParamObj = ruleContext.getVplatformInput();
			if (!inParamObj) { //建议兼容
				inParamObj = "";
			}else{
				inParamObj = inParamObj.dataSourceMap[0];
			}
			inParamObj.count = inParamObj.count ? experssFunc(inParamObj.count) : inParamObj.count;
			inParamObj.isFront = inParamObj.isFront ? experssFunc(inParamObj.isFront) : inParamObj.isFront;
			//图片质量
			var quatity = experssFunc(inParamObj.quatity);
			if (quatity == null || quatity == "") {
				quatity = 50;
			} else {
				//转换成数字
				quatity = getNum(quatity, reject);
				if (quatity < 0 || quatity > 100) {
					reject(vds.exception.newBusinessException("图片质量不能小于0且不能大于100"));
					return;
				}
			}
			inParamObj.quatity = quatity;
			inParamObj.saveToAlbum = inParamObj.saveToAlbum ? experssFunc(inParamObj.saveToAlbum) : inParamObj.saveToAlbum;
			var saveTarget = inParamObj.saveTarget;
			if (saveTarget == "app") {
				save2Native(ruleContext, inParamObj, resolve, reject);
			} else {
				upload2Server(ruleContext, inParamObj, resolve, reject);
			}
		} catch (err) {
			reject(err);
		}
	});
}
/**
 * 设置规则返回值
 * @param {RuleContext} ruleContext 规则上下文
 * @param {Any} value 值
 */
var setResult = function (ruleContext, value) {
	var code = "isSuccess";
	if (ruleContext.setResult) {
		ruleContext.setResult(code, value)
	}
}
var upload2Server = function (ruleContext, inParamObj, resolve, reject) {
	var type = inParamObj.sourceType;
	if (type == "filePath") {
		uploadFromFilePath(ruleContext, inParamObj, resolve, reject);
	} else {
		uploadFromUserSelect(ruleContext, inParamObj, resolve, reject);
	}
}

var uploadFromFilePath = function (ruleContext, inParamObj, resolve, reject) {
	//1.从实体中获取本地文件路径
	var sEntityCode = inParamObj.sourceEntityCode;
	var sFieldCode = inParamObj.sourceFieldCode;
	var sDataSource = GetDataSource(sEntityCode, ruleContext);
	if (!sDataSource) {
		reject(vds.exception.newConfigException("请检查实体" + sEntityCode + "是否存在"));
		return;
	}
	var datas = sDataSource.getAllRecords().toArray();//???
	if (datas.length > 0) {
		var filePaths = [];
		for (var i = 0; i < datas.length; i++) {
			var data = datas[i];
			var fPath = data.get(sFieldCode);
			if (fPath && fPath.indexOf("file://") != -1) {
				fPath = fPath.substring(fPath.indexOf("file://") + 7, fPath.length);
				filePaths.push(fPath);
			}
		}
		var uploadSuccess = function (fileIds) {
			var resultEntityCode = inParamObj.resultEntityCode;
			var resultFieldCode = inParamObj.resultFieldCode;
			var rDataSource = GetDataSource(resultEntityCode, ruleContext);
			if (!rDataSource) {
				reject(vds.exception.newBusinessException("请检查实体【" + resultEntityCode + "】是否存在"));
				return;
			}
			if (fileIds) {
				var insertRecords = [];
				for (var i = 0; i < fileIds.length; i++) {
					var fileId = fileIds[i];
					var emptyRecord = rDataSource.createRecord();
					emptyRecord.set(resultFieldCode, fileId);
					insertRecords.push(emptyRecord);
				}
				rDataSource.insertRecords(insertRecords);
			}
			setResult(ruleContext, true);
			resolve();
		}
		uploadSuccess = ruleContext.genAsynCallback(uploadSuccess);
		vds.app.upload(filePaths, uploadSuccess);
		// var promise = vds.app.upload(filePaths, uploadSuccess);
		// promise.then(uploadSuccess).catch(function () {
		// 	setResult(ruleContext, false);
		// 	reject(vds.exception.newBusinessException("上传图片不成功"));
		// });
	} else {
		setResult(ruleContext, true);
		resolve();
	}
}

var uploadFromUserSelect = function (ruleContext, inParamObj, resolve, reject) {
	var type = inParamObj.sourceType;
	var dataSource = GetDataSource(inParamObj.resultEntityCode, ruleContext);
	if (!dataSource) {
		reject(vds.exception.newConfigException("请检查实体" + entityCode + "是否存在"));
		return;
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
	$("body #md-bg-imgupload").on("click", removeDailog);
	$("body #main-imgupload li").on("click", function () {
		var valueCode = $(this).attr("data-value");
		//失败后回调
		var FailCallBack = function () {
			setResult(ruleContext, false);
			removeDailog();
			reject(vds.exception.newBusinessException("上传图片不成功"));
		}
		//成功后回调
		removeDailog();
		var SuncceccCallBack = function (imagePath) {
			if (imagePath && imagePath.length > 0) {
				//上传后的回调,设置规则返回值
				var uploadSuccess = function (fileIds) {
					if (fileIds) {
						var insertRecords = [];
						for (var i = 0; i < fileIds.length; i++) {
							var fileId = fileIds[i];
							var emptyRecord = dataSource.createRecord();
							emptyRecord.set(fieldCode, fileId);
							insertRecords.push(emptyRecord);
						}
						dataSource.insertRecords(insertRecords);
					}
					setResult(ruleContext, true);
					resolve();
				}
				if (valueCode == "picture") {
					imagePath = StringToArray(imagePath);
				}
				vds.app.upload(imagePath, uploadSuccess);
				//var promise = vds.app.upload(imagePath, uploadSuccess);
				//promise.then(uploadSuccess).catch(FailCallBack)
			} else {
				setResult(ruleContext, false);
				resolve();
			}
		}
		var options = {};
		options["quality"] = inParamObj.quatity;
		if (valueCode == "cancle") {
			removeDailog();
			setResult(ruleContext, false);
			resolve();
			return;
		} else if (valueCode == "picture") {
			options["isFront"] = inParamObj.isFront === true;
			options["saveToAlbum"] = inParamObj.saveToAlbum === true;
			var promise = vds.app.picture(options);
			promise.then(SuncceccCallBack).catch(FailCallBack);
		} else if (valueCode == "album") {
			/*设置相册最大选择数量*/
			options["max"] = inParamObj.count;
			var promise = vds.app.getPicture(options);
			promise.then(SuncceccCallBack).catch(FailCallBack);
		} else {
			removeDailog();
			setResult(ruleContext, false);
			reject(vds.exception.newConfigException("暂时不支持这种类型：" + valueCode));
			return;
		}
	});
	showDailog(type);
}

var save2Native = function (ruleContext, inParamObj, resolve, reject) {
	var type = inParamObj.sourceType;
	var dataSource = GetDataSource(inParamObj.resultEntityCode, ruleContext);
	if (!dataSource) {
		reject(vds.exception.newConfigException("请检查实体" + entityCode + "是否存在"));
		return;
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
	$("body #md-bg-imgupload").on("click", removeDailog);
	$("body #main-imgupload li").on("click", function () {
		removeDailog();
		var valueCode = $(this).attr("data-value");
		//成功后回调
		var SuncceccCallBack = function (imagePath) {
			if (imagePath && imagePath.length > 0) {
				//上传后的回调,设置规则返回值
				var uploadSuccess = function (results) {
					if (results && undefined != results.success && (results.success == false || results.success == "false")) {
						setResult(ruleContext, false);
						reject(vds.exception.newConfigException("上传图片不成功"));
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
							dataSource.insertRecords(insertRecords);
						}
						setResult(ruleContext, true);
						resolve();
					}
				}
				uploadSuccess = ruleContext.genAsynCallback(uploadSuccess);
				if (valueCode == "picture") {
					imagePath = StringToArray(imagePath);
				}
				save2App(imagePath, uploadSuccess, resolve);
			} else {
				setResult(ruleContext, false);
				resolve();
			}
		}
		SuncceccCallBack = ruleContext.genAsynCallback(SuncceccCallBack);
		//失败后回调
		var FailCallBack = function (errorMsg) {
			setResult(ruleContext, false);
			removeDailog();
			resolve();
		}
		var options = {};
		options["quality"] = inParamObj.quatity;
		if (valueCode == "cancle") {
			removeDailog();
			setResult(ruleContext, false);
			resolve();
			return;
		} else if (valueCode == "picture") {
			options.isFront = inParamObj.isFront === true;
			options.saveToAlbum = inParamObj.saveToAlbum === true;
			var promise = vds.app.picture(options);
			promise.then(SuncceccCallBack).catch(FailCallBack);
		} else if (valueCode == "album") {
			/*设置相册最大选择数量*/
			options["max"] = inParamObj.count;
			var promise = vds.app.getPicture(options);
			promise.then(SuncceccCallBack).catch(FailCallBack);
		} else {
			removeDailog();
			setResult(ruleContext, false);
			reject(vds.exception.newBusinessException("图片上传规则暂时不支持这种类型：" + valueCode));
			return;
		}
	});
	showDailog(type);
}

var getFileName = function (filePath) {
	var fileName = filePath.substring(filePath.lastIndexOf("/") + 1, filePath.length);
	return fileName;
}

var save2App = function (sourceFilePath, callback, resolve) {
	var fileIndex = 0;
	vds.progress.show("正在保存图片...");
	var results = [];
	for (var i = 0; i < sourceFilePath.length; i++) {
		var fPath = sourceFilePath[i];
		var fileName = getFileName(fPath);
		var fileURL;
		if (window.device && window.device.platform == "iOS") {
			fileURL = cordova.file.documentsDirectory + "appimage/" + fileName;
		} else {
			fileURL = cordova.file.dataDirectory + "appimage/" + fileName;
		}
		var fileTransfer = new FileTransfer();
		var uri = encodeURI(fPath);
		try{
			fileTransfer.download(uri, fileURL, function (entry) {
					results.push(entry.nativeURL);
					fileIndex++;
					vds.progress.hide();
					if (fileIndex == sourceFilePath.length) {
						callback(results);
					} else {
						resolve();
					}
				},function (error) {
					vds.progress.hide();
					alert("保存失败");
					callback(error);
				}, false, {
				"headers": {
					"Authorization": "Basic dGVzdHVzZXJuYW1lOnRlc3RwYXNzd29yZA=="
				}
			});
		}catch(e){
			alert(e.message);
		}
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
 * @desc 获取数字类型的值,不是数字会抛异常
 * @param sourceValue 来源值(String|Number)
 * @param reject 参数名称
 * @returns targetValue 数字类型的值(Number)
 * @vjs
 * 		"vjs.framework.extension.util.math":null
 * @service
 * 		mathUtil = sandbox.getService("vjs.framework.extension.util.Math");
 * */
function getNum(sourceValue, reject) {
	if (sourceValue == null || sourceValue == "") {
		return 0;
	}
	if (!vds.object.isNumber(sourceValue) || Number(sourceValue) == "NaN") {
		throw vds.exception.newConfigException("图片质量不是数字，请检查");
	}
	return Number(sourceValue);
}

/**
 * desc 执行表达式
 * experss 表达式
 * ruleContext 规则上下文
 * */
function experssFunc(experss, ruleContext) {
	if (experss == null || experss == "") {
		return null;
	}
	var resultValue = vds.expression.execute(experss, {
		"ruleContext": ruleContext
	});
	return resultValue;
}

//获取实体对象
function GetDataSource(ds, ruleContext) {
	var dsName = ds;
	var datasource = null;
	if (vds.ds.isDatasource(dsName)) {
		datasource = dsName;
	} else {
		if (dsName.indexOf(".") == -1 && dsName.indexOf("@") == -1) {
			datasource = vds.ds.lookup(dsName);
		} else {
			datasource = vds.expression.execute(dsName, {
				"ruleContext": ruleContext
			});
		}
	}
	return datasource;
}

export {
	main
}