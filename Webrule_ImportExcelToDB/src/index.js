/**
 *
 *
 */
vds.import("vds.widget.*", "vds.exception.*", "vds.expression.*", "vds.ds.*", "vds.component.*", "vds.window.*", "vds.string.*", "vds.log.*")
/**
 * 规则入口
 */
var main = function (ruleContext) {
	return new Promise(function (resolve, reject) {
		try {
			var inParamObj = ruleContext.getVplatformInput();
			if (!inParamObj) {//建议兼容
				inParamObj = "";
			}
			var ruleConfig = ruleContext.getRuleCfg();//？？？
			var instanceCode = ruleConfig.instanceCode;//???
			inParamObj = MapTransform(inParamObj, ruleContext);
			var fileSource = inParamObj.fileSource;// 上传控件id
			var useAttachment = true;
			if (fileSource == null || fileSource == "") {
				useAttachment = false;
			}
			var widget = vds.widget.getProperty(fileSource, "widgetObj");
			if (!widget) {
				useAttachment = false;
			}
			var selectIdList = {};
			var varMapList = {};
			var tmpm = [];
			for (var a = 0; a < inParamObj["items"].length; a++) {
				var _inParamObj = inParamObj["items"][a];
				var dataSourceName = _inParamObj.dataName;
				var sheetn = _inParamObj.sheetNum;
				var _ide = dataSourceName + "_" + sheetn;
				if (!tmpm.contains(_ide)) {
					tmpm[a] = _ide;
				} else {
					throw vds.exception.newConfigException("同一个sheetno不能导入相同的表中");
				}
				var treeStruct = inParamObj["treeStruct"] == null ? null : GetTreeStruct(inParamObj["treeStruct"], dataSourceName);// 获取树结构配置
				//inParamObj["items"][a]["treeStruct"] = treeStruct==null?"":treeStruct;
				inParamObj["items"][a]["treeStruct"] = treeStruct;//==null?"":treeStruct;
				var dataType = treeStruct != null ? "tree" : "Table"; // 为Table或Tree
				inParamObj["items"][a]["dataType"] = dataType;//==null?"":treeStruct;
				var importNodeId = treeStruct != null ? _inParamObj["importNodeId"] : "";// 导入目标树节点id
				dataType = dataType.toLowerCase();
				//			// 得到导入的目标节点id值
				var selectId = '';
				if (dataType == "tree") {
					if (treeStruct == null || treeStruct.length == 0) {
						throw vds.exception.newConfigException("规则配置中没有树结构信息")
					}
					if (treeStruct.type != "1" && treeStruct.type != "2") {
						throw vds.exception.newConfigException("规则配置中树类型只能为层级码树或左右树");
					}
					if (importNodeId != null && importNodeId != "") {
						selectId = vds.expression.execute(importNodeId, {
							"ruleContext": ruleContext
						});
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
						var datasource = vds.ds.lookup(dataSourceName);
						if (!datasource) {
							throw vds.exception.newConfigException("实体【" + dataSourceName + "】不存在，请检查配置.");
						}
						var currentRow = datasource.getCurrentRecord();
						var datasource = vds.ds.lookup(changeDsArr[changeIndex]);
						var db = datasourceclearRemoveDatas();

						if (currentRow != null) {
							varMap[fieldCode] = currentRow.get(value);
						} else {
							varMap[fieldCode] = null;
						}
					} else if (source === 'System') {//系统变量
						varMap[fieldCode] = vds.component.getVariant(value);
					} else if (source === 'Component') {//组件变量
						varMap[fieldCode] = vds.window.getInput(value);
					} else if (source === 'Express' || source === 'expression') {//表达式
						varMap[fieldCode] = vds.expression.execute(value, {
							"ruleContext": ruleContext
						});
					}
					varMapList[_ide] = varMap;
				}
			}


			var actionType = "importTable";
			var routeRuntime = ruleContext.getRouteContext();
			var transactionId = routeRuntime.getTransactionId();
			// actionType="importEntity";
			var option = {
				ruleInstId: instanceCode,
				selectId: selectIdList,
				action: actionType,
				varMap: varMapList,
				ruleConfig: vds.string.toJson(inParamObj),
				instance: transactionId,/**不知道干什么的,可能多余的 jiqj */
				transactionId: transactionId /**后台需要这个进行事物管理, 事物id变量错误，导致没有与前一个事务串联 jiqj*/
			};
			var callback = function (arg1, arg2) {
				try {
					vds.log.log("结束发送时间：" + new Date().toLocaleTimeString());
					if (arg2) {
						if (arg2.success) {
							resolve();
						} else {
							// var type = arg2.exceptionType;
							// var msg = arg2.msg;
							// var exception = factory.create(arg2);
							// exception.markServiceException();
							// ruleContext.handleException(exception);
							reject(arg2);//异常对象应该由内部封装
						}
					} else {
						vds.log.error("上传控件回调参数不正确，请处理！");
					}
				} finally {
				}
			}
			callback = ruleContext.genAsynCallback(callback);
			var start = new Date();
			vds.log.log("开始发送时间：" + start.toLocaleTimeString());
			//创建input表单
			// 创建好以后出发点击事件
			// 文件选择事件中出发后续逻辑
			// 逻辑完成后触发删除之前创建的input表单
			if (useAttachment) {
				vds.widget.execute(fileSource, "importData", [option, callback])
			} else {
				option.componentCode = vds.component.getCode();
				option.windowCode = vds.window.getCode();
				if ($("#importExcelToDBFileButton").length > 0) {
					$("#importExcelToDBFileButton").next().remove();
					$("#importExcelToDBFileButton").remove();
				}

				var fileInput = "<div id='importExcelToDBFileButton' style='display:none'>隐藏按钮</div>";
				$("body").append(fileInput);

				var error_msg;
				var plupload_upload_obj = new plupload.Uploader({ //实例化一个plupload上传对象
					runtimes: 'html5,flash,html4',
					browse_button: 'importExcelToDBFileButton',
					url: 'module-operation!executeOperation?operation=FileUpload&ajaxRequest=true',
					multipart_params: {},
					multi_selection: false,
					//	            filters: {
					//	                mime_types: [{
					//	                    title: "files",
					//	                    extensions: control_sc_obj.file_types != undefined ? control_sc_obj.file_types.replaceAll("*.", "").replaceAll(";", ",") : "*"
					//	                }],
					//	                max_file_size: control_sc_obj.file_size_limit + 'kb'
					//	            },
					init: {
						"FilesAdded": function (uploader, files) { //添加文件触发
							plupload_upload_obj.start();
						},
						"FileUploaded": function (uploader, file, responseObject) { //每个文件上传完成触发
							error_msg = isc.JSON.decode(responseObject.response);
							//	                	console.log("导入数据事件：FileUploaded"  );
						},
						"UploadComplete": function (uploader, files) { //全部文件上传完成触发
							callback(files, error_msg);
						},
						"Init": function () {
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
				plupload_upload_obj._handleRequestDataByV3 = function (datas) {
					if (datas && dataValidateUtil.genAsciiCode) {
						var url = this.settings.url;
						if (undefined != url && url.indexOf("?") != -1) {
							var urlParamArr = url.split("?")[1].split("&");
							for (var i = 0, len = urlParamArr.length; i < len; i++) {
								var param = urlParamArr[i];
								if (param.indexOf("=") != -1) {
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
			}
		} catch (err) {
			reject(err);
		}
	});
}
// var dataValidateUtil;
// exports.initModule = function (sBox) {
// 	dataValidateUtil = sBox.getService("vjs.framework.extension.util.DataValidateUtil");
// }
var genUUID = function () {
	var S4 = function () {
		return (((1 + Math.random()) * 0x10000) | 0).toString(16)
			.substring(1);
	};
	return (S4() + S4() + S4() + S4() + S4() + S4() + S4() + S4());
};

function GetTreeStruct(treeStruct, tableName) {
	for (var i = 0; i < treeStruct.length; i++) {
		var _var = treeStruct[i];
		if (tableName == _var["tableName"]) {
			return _var;
		}
	}
	return null;
}
function MapTransform(inParamObj, ruleContext) {
	var result = {};
	result["fileSource"] = inParamObj["fileSource"];
	result["treeStruct"] = inParamObj["treeStruct"];
	var _rel = [];
	for (var i = 0; i < inParamObj["items"].length; i++) {
		var _re = {};
		var _inParamObj = inParamObj["items"][i];
		_re["fileType"] = "Excel";
		_re["dataName"] = _inParamObj["targetTable"];
		var retValue = vds.expression.execute(_inParamObj["sheetNum"], {
			"ruleContext": ruleContext
		});
		_re["sheetNum"] = Number(retValue);
		_re["startRow"] = _inParamObj["dataStartRow"];
		_re["importNodeId"] = _inParamObj["importNodeId"];
		var _ma = [];
		for (var j = 0; j < _inParamObj["mapping"].length; j++) {
			var _map = {};
			var _mapping = _inParamObj["mapping"][j];
			_map["chineseName"] = _mapping["fieldName"];
			_map["fieldName"] = _mapping["fieldCode"];
			if (_mapping["sourceType"] == "excelColName") {
				_map["source"] = "Excel";
			} else if ("excelColNum" == _mapping["sourceType"]) {
				_map["source"] = "ExcelColCode";
			} else {
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
export {
	main
}