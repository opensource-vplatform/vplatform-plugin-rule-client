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
			if (!inParamObj) { //建议兼容
				inParamObj = "";
			}
			// var ruleConfig = ruleContext.getRuleCfg(); //？？？
			// var instanceCode = ruleConfig.instanceCode; //???
			inParamObj = MapTransform(inParamObj, ruleContext);
			var fileSource = inParamObj.fileSource; // 上传控件id
			var useAttachment = true;
			if (fileSource == null || fileSource == "") {
				useAttachment = false;
			}
			var widget = vds.widget.getProperty(fileSource, "widgetObj");
			if (!widget) {
				useAttachment = false;
			}
			var selectIdList = {};
			// var varMapList = {};
			var tmpm = [];
			var configs = [];
			for (var a = 0; a < inParamObj["items"].length; a++) {
				var _inParamObj = inParamObj["items"][a];
				var dataSourceName = _inParamObj.tableCode;
				var sheetn = _inParamObj.sheetNum;
				var _ide = dataSourceName + "_" + sheetn;
				if (!tmpm.contains(_ide)) {
					tmpm[a] = _ide;
				} else {
					throw vds.exception.newConfigException("同一个sheetno不能导入相同的表中");
				}
				var config = {};
				var treeStruct = inParamObj["treeStruct"] == null ? null : GetTreeStruct(inParamObj["treeStruct"], dataSourceName); // 获取树结构配置
				//inParamObj["items"][a]["treeStruct"] = treeStruct==null?"":treeStruct;
				inParamObj["items"][a]["treeStruct"] = treeStruct; //==null?"":treeStruct;
				var dataType = treeStruct != null ? "tree" : "Table"; // 为Table或Tree
				inParamObj["items"][a]["dataType"] = dataType; //==null?"":treeStruct;
				var importNodeId = treeStruct != null ? _inParamObj["importNodeId"] : ""; // 导入目标树节点id
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
				// var varMap = {};

				if(useAttachment){
					for (var i = 0; i < _inParamObj.dgcolumn.length; i++) {
						var dgc = _inParamObj.dgcolumn[i];
						var source = dgc.type;
						// var fieldCode = dgc.fieldName;
						var value = dgc.value;
						if (source === 'Entity') {
							dataSourceName = value.substring(0, value.indexOf("."));
							var datasource = vds.ds.lookup(dataSourceName);
							if (!datasource) {
								throw vds.exception.newConfigException("实体【" + dataSourceName + "】不存在，请检查配置.");
							}
							var currentRow = datasource.getCurrentRecord();
							var datasource = vds.ds.lookup(changeDsArr[changeIndex]);
							if (currentRow != null) {
								dgc["value"] = currentRow.get(value);
							} else {
								dgc["value"] = null;
							}
						} else if (source === 'System') { //系统变量
							dgc["value"] = vds.component.getVariant(value);
						} else if (source === 'Component') { //组件变量
							dgc["value"] = vds.window.getInput(value);
						} else if (source === 'Express' || source === 'expression') { //表达式
							dgc["value"] = vds.expression.execute(value, {
								"ruleContext": ruleContext
							});
						}
				}
					// varMapList[_ide] = varMap;
				}
				var config = {
					tableCode : dataSourceName,
					treeStruct : treeStruct,
					sheetNum : sheetn + 1,
					startRow : _inParamObj.startRow,
					fieldMappings : _inParamObj.dgcolumn
				}
				configs.push(config);
			}


			// var actionType = "importTable";
			// var routeRuntime = ruleContext.getRouteContext();
			// var transactionId = routeRuntime.getTransactionId();
			// actionType="importEntity";
			// var option = {
			// 	// ruleInstId: instanceCode,
			// 	// selectId: selectIdList,
			// 	// action: actionType,
			// 	// varMap: varMapList,
			// 	// ruleConfig: vds.string.toJson(inParamObj),
			// 	// instance: transactionId,/**不知道干什么的,可能多余的 jiqj */
			// 	// transactionId: transactionId /**后台需要这个进行事物管理, 事物id变量错误，导致没有与前一个事务串联 jiqj*/
			// };
			// var callback = function (arg1, arg2) {
			// 	try {
			// 		vds.log.log("结束发送时间：" + new Date().toLocaleTimeString());
			// 		if (arg2) {
			// 			if (arg2.success) {
			// 				resolve();
			// 			} else {
			// 				reject(arg2); //异常对象应该由内部封装
			// 			}
			// 		} else {
			// 			vds.log.error("上传控件回调参数不正确，请处理！");
			// 		}
			// 	} finally {}
			// }
			// callback = ruleContext.genAsynCallback(callback);
			// var start = new Date();
			// vds.log.log("开始发送时间：" + start.toLocaleTimeString());
			//创建input表单
			// 创建好以后出发点击事件
			// 文件选择事件中出发后续逻辑
			// 逻辑完成后触发删除之前创建的input表单
			if (useAttachment) {
				var callback = function(arg2, error){
					if(error instanceof Error || vds.exception.isException(error)){
						reject(error);
					}else{
						resolve();
					}
				}
				vds.widget.execute(fileSource, "importData", [configs, callback])
			} else {
				var promise = vds.rpc.importExcel(configs, ruleContext.getMethodContext());
				promise.then(resolve).catch(reject);
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
		// _re["fileType"] = "Excel";
		// _re["dataName"] = _inParamObj["targetTable"];
		var retValue = vds.expression.execute(_inParamObj["sheetNum"], {
			"ruleContext": ruleContext
		});
		_re["sheetNum"] = Number(retValue);
		_re["tableCode"] = _inParamObj["targetTable"];
		_re["startRow"] = _inParamObj["dataStartRow"];
		_re["importNodeId"] = _inParamObj["importNodeId"];
		var _ma = [];
		for (var j = 0; j < _inParamObj["mapping"].length; j++) {
			var _map = {};
			var _mapping = _inParamObj["mapping"][j];
			_map["chineseName"] = _mapping["fieldName"];
			_map["fieldName"] = _mapping["fieldCode"];
			if (_mapping["sourceType"] == "excelColName") {
				_map["type"] = "ExcelName";
			} else if ("excelColNum" == _mapping["sourceType"]) {
				_map["type"] = "ExcelCode";
			} else {
				_map["type"] = _mapping["sourceType"];
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