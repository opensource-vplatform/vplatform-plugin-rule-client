/**
 * 多语言操作
 */
//vds.import("vds.");
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
			var languageOperation = inParamObj.languageOperation,
				lang = inParamObj.language,
				languageType = inParamObj.languageType,
				returnMapping = inParamObj.returnMapping;

			var curComponentCode = vds.component.getCode();
			var global_cb = function (responseObj) {
				_setDataToObject(returnMapping, responseObj, ruleContext);
				return true;
			};
			var value = null;
			if (languageOperation && languageOperation == "getCurLanguage") {
				// 获取当前窗体资源包语言
				//var curLanguage = resourcePackage.getWindowCurrentResourceCode(curComponentCode, curWindowCode);
				value = '{"languageOperation":"getCurLanguage", "componentCode":"' + curComponentCode + '"}'
			} else if (languageOperation == "getLanguages") {// 获取语言列表
				// 处理返回的 json(map) 数据, 设置返回数据到前台实体/.../...
				value = '{"languageOperation":"getLanguages", "componentCode":"' + curComponentCode + '"}';
			} else {// 设置当前默认语言
				// 获取设置的语言
				if (languageType == "dynamic" && lang)
					lang = vds.expression.execute(lang);
				global_cb = resolve;
				value = '{"language":"' + lang + '", "componentCode":"' + curComponentCode + '","languageOperation":"setCurLanguage"}'
			}
			var promise = vds.rpc.callCommand("CommonRule_LanguageOperation", [{
				"code": "InParams",
				"type": "char",
				"value": value
			}], {
				"isAsyn": false
			});
			promise.then(global_cb).catch(reject);
		} catch (err) {
			reject(err);
		}
	});
}
/**
 * 设置规则返回值
 * @param {RuleContext} ruleContext 规则上下文
 * @param {String} code 返回值编码
 * @param {Any} value 值
 */
var setResult = function (ruleContext, code, value) {
	if (ruleContext.setResult) {
		ruleContext.setResult(code, value)
	}
}



var jsonUtil, resourcePackage, scopeManager, renderer, widgetContext, remoteServer, dsFactory, dbService, formulaUtil, viewContext, viewModel;

exports.initModule = function (sBox) {
	if (sBox) {
		jsonUtil = sBox.getService("vjs.framework.extension.util.JsonUtil");
		resourcePackage = sBox.getService("vjs.framework.extension.platform.services.resourcepackage.ResourcePackage");
		renderer = sBox.getService("vjs.framework.extension.ui.common.plugin.services.Renderer");
		widgetContext = sBox.getService("vjs.framework.extension.widget.manager.widgetContext");
		remoteServer = sBox.getService("vjs.framework.extension.platform.services.operation.remote.RemoteMethodAccessor");
		dsFactory = sBox.getService("vjs.framework.extension.platform.interface.model.datasource.DatasourceFactory");
		dbService = sBox.getService("vjs.framework.extension.rule.common.plugin.services.db.dbService");
	}
	scopeManager = require('global/scope/scopeManager');
	formulaUtil = require("system/util/formulaUtil");
	viewContext = require("system/view/viewContext");
	viewModel = require("system/view/viewModel");
}

// 创建游离 DB 对象信息
var _createDBInfo = function (obj) {
	var len = 0;
	var objs = [];
	for (var key in obj) {
		len = len + 1;

		var objectTmp = new Object;
		objectTmp.id = len;
		objectTmp.code = key;
		objectTmp.name = obj[key];
		objs.push(objectTmp);
	}

	var result = new Object,
		metadata = new Object,
		model = new Object;

	var datas = {
		"recordCount": len,
		"values": objs
	};
	result.datas = datas;

	var fields = [{
		"code": "id",
		"name": "id",
		"length": 255,
		"type": "char",
		"defaultValue": "",
		"precision": ""
	}, {
		"code": "code",
		"name": "code",
		"length": 255,
		"type": "char",
		"defaultValue": "",
		"precision": ""
	}, {
		"code": "name",
		"name": "name",
		"length": 255,
		"type": "char",
		"defaultValue": "",
		"precision": ""
	}];

	model.datasourceName = "FreeLangListTb";
	model.fields = fields;
	metadata.model = [model];
	result.metadata = metadata;

	var result = vds.ds.unSerialize(fields,{
		"dsCode": "FreeLangListTb",
		"datas": objs
	});
	return result;
};

var _setDataToObject = function (returnMapping, responseObj, ruleContext) {
	if (returnMapping && returnMapping.length > 0) {
		for (var i = 0; i < returnMapping.length; i++) {
			var mapping = returnMapping[i],
				dest = mapping["dest"];

			if (!dest)
				throw vds.exception.newConfigException("语言操作规则出错：返回值设置目标不能为空！");

			var destType = mapping["destType"], //目标类型（entity：实体，control：控件，windowVariant：窗体变量，systemVariant：系统变量）
				src = mapping["src"], //来源(returnValue:返回值，expression:表达式)
				srcType = mapping["srcType"]; //来源(当目标类型是实体时，返回实体存在此处)

			// 目标对象为实体
			if (dbService.isEntity(dest, destType, ruleContext)) {
				var outputResult = responseObj.OutputJson,
					outputObj = jsonUtil.json2obj(outputResult),
					freeDb = _createDBInfo(outputObj),
					// freeDb = dsFactory.unSerialize(freeDbInfo),
					srcRecords = freeDb.getAllRecords().toArray(),
					destFieldMapping = mapping["destFieldMapping"],
					updateDestEntityMethod = mapping["updateDestEntityMethod"],
					isCleanDestEntityData = mapping["isCleanDestEntityData"];

				if (updateDestEntityMethod == null)
					updateDestEntityMethod = "insertOrUpdateBySameId";

				dbService.insertOrUpdateRecords2Entity(dest, destType, srcRecords, destFieldMapping, updateDestEntityMethod, isCleanDestEntityData, ruleContext);
			} else {
				var value = responseObj.OutputJson;

				switch (destType) {
					case "windowVariant":
						viewContext.setVariableValue(dest, value);
						break;
					case "systemVariant":
						viewContext.setSystemVariableValue(dest, value);
						break;
					case "control":
						_setWidgetValue(dest, value);
						break;
					case "ruleSetVariant":
						routeContext.setVariable(dest, value);
						break;
					case "ruleSetOutput":
						routeContext.setOutputParam(dest, value);
						break;
					case "windowOutput":
						viewContext.setWindowOutputValue(dest, value);
						break;
					default:
						log.error("无效的目标类型：" + destType);
						break;
				}
			}
		}
	}
};

/**
 * 给控件赋值
 */
var _setWidgetValue = function (destWidgetId, value) {
	if (destWidgetId != null && destWidgetId.indexOf(".") != -1) {
		var splits = destWidgetId.split(".");
		var widgetId = splits[0];
		var dbFieldName = vmMappingUtil.getRefFieldFromWidgetPropertyCode(destWidgetId);
		var valueObj = {};
		valueObj[dbFieldName] = value;
		viewModel.getDataModule().setSingleRecordMultiValue(widgetId, valueObj);
	} else {
		viewModel.getDataModule().setSingleValue(destWidgetId, value);
	}
};

export {
	main
}