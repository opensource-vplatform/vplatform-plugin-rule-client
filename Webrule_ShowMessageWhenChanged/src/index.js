/**
 * 组件数据发生改变时提示用户(用于数据修改时需要提示用户或者询问用户的场景。)
 */


	// var jsonUtil;
	// var dialogUtil;
	// var ExpressionContext;
	// var engine;
	// var datasourcePuller;

	// exports.initModule = function(sBox) {
	// 	jsonUtil = sBox.getService("vjs.framework.extension.util.JsonUtil");
	// 	dialogUtil = sBox.getService("vjs.framework.extension.platform.services.view.widget.common.dialog.DialogUtil");
	// 	ExpressionContext = sBox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionContext");
	// 	engine = sBox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionEngine");
	// 	datasourcePuller = sBox.getService("vjs.framework.extension.platform.services.domain.datasource.DatasourcePuller");
	// }

	// var SHOWTYPE_CONFIRM = "1"; // 1:询问（确定/取消），根据用户选择继续或终止

	// var main = function(ruleContext) {
	// 	var ruleCfgValue = ruleContext.getRuleCfg();
	// 	var inParams = ruleCfgValue["inParams"];
	// 	var inParamsObj = jsonUtil.json2obj(inParams);
	// 	var showType = inParamsObj["showType"]; // 0为不询问（直接返回改变状态T/F），1为询问（确定/取消）
	// 	var simpleChinesePrompt = inParamsObj["simpleChinesePrompt"]; // 简体中文内容
	// 	var simpleChinesetype = inParamsObj["simpleChinesetype"]; // 简体中文内容类型:0为字符串，1为表达式
	// 	var tableNames = inParamsObj["tablesName"]; // 数据源数组
	// 	if (tableNames == null || tableNames == undefined || tableNames.length == 0) {
	// 		throw "没有选择数据源，请检查";
	// 	}
	// 	// 遍历数据源判断是否有数据更改
	// 	var isChanged = false;
	// 	var userConfirm = true;
	// 	for (var index = 0; index < tableNames.length; index++) {
	// 		var result = datasourcePuller.hasChanged({
	// 			"datasourceName": tableNames[index]
	// 		});
	// 		if (result) {
	// 			isChanged = true;
	// 			break;
	// 		}
	// 	}
	// 	var callback = function(val) {
	// 		userConfirm = typeof(val) == "boolean" ? val : userConfirm;
	// 		setBusinessRuleResult(ruleContext, isChanged, userConfirm);
	// 		ruleContext.setRuleStatus(true);
	// 		ruleContext.fireRouteCallback();
	// 	}

	// 	//当数据已改变、并且需要提示信息的时候，处理下提示信息
	// 	if (isChanged == true && SHOWTYPE_CONFIRM == showType) {
	// 		var message = simpleChinesePrompt; //提示信息(目前只取简体中文);
	// 		var messageType = simpleChinesetype; //提示信息类型0代表非表达式，1代表表达式
	// 		if (message != null && "1" == messageType) {
	// 			var context = new ExpressionContext();
	// 			context.setRouteContext(ruleContext.getRouteContext());
	// 			var message = engine.execute({
	// 				"expression": message,
	// 				"context": context
	// 			});
	// 		}
	// 		if (message == null || String(message) == '') {
	// 			throw new Error("请设置有效的提示信息");
	// 		}
	// 		message = String(message);
	// 		if (message != '' && (message.substring(0, 1) == "\"" || message.substring(0, 1) == "'")) {
	// 			message = message.substring(1);
	// 		}
	// 		if (message != '' && (message.substring(message.length - 1, message.length) == "\"" || message.substring(message.length - 1, message.length) == "'")) {
	// 			message = message.substring(0, message.length - 1);
	// 		}
	// 		userConfirm = dialogUtil.confirmDialog(message, callback, false);
	// 	} else {
	// 		setBusinessRuleResult(ruleContext, isChanged, userConfirm);
	// 		ruleContext.setRuleStatus(true);
	// 		ruleContext.fireRouteCallback();
	// 	}
	// 	ruleContext.markRouteExecuteUnAuto();
	// 	return true;
	// };

	// /**
	//  * 设置业务返回结果
	//  */
	// function setBusinessRuleResult(ruleContext, result, userConfirm) {
	// 	if (ruleContext.setBusinessRuleResult) {
	// 		ruleContext.setBusinessRuleResult({
	// 			isChanged: result,
	// 			confirm: userConfirm
	// 		});
	// 	}
	// }

	// exports.main = main;
vds.import("vds.object.*","vds.exception.*","vds.expression.*","vds.message.*","vds.ds.*");
var main = function(ruleContext){
	return new Promise(function(resolve, reject){
		try{
			var inParamsObj = ruleContext.getVplatformInput();
			var showType = inParamsObj["showType"]; // 0为不询问（直接返回改变状态T/F），1为询问（确定/取消）
			var simpleChinesePrompt = inParamsObj["simpleChinesePrompt"]; // 简体中文内容
			var simpleChinesetype = inParamsObj["simpleChinesetype"]; // 简体中文内容类型:0为字符串，1为表达式
			var tableNames = inParamsObj["tablesName"]; // 数据源数组
			if (tableNames == null || tableNames == undefined || tableNames.length == 0) {
				reject(vds.exception.newConfigException("没有配置数据源，请检查."));
				return;
			}
			// 遍历数据源判断是否有数据更改
			var isChanged = false;
			var userConfirm = true;
			for (var index = 0; index < tableNames.length; index++) {
				var result = hasChanged(tableNames[index]);
				if (result) {
					isChanged = true;
					break;
				}
			}
			var callback = function(val) {
				userConfirm = typeof(val) == "boolean" ? val : userConfirm;
				setBusinessRuleResult(ruleContext, isChanged, userConfirm);
				ruleContext.setRuleStatus(true);
				ruleContext.fireRouteCallback();
				resolve();
			}

			ruleContext.markRouteExecuteUnAuto();
			//当数据已改变、并且需要提示信息的时候，处理下提示信息
			if (isChanged == true && SHOWTYPE_CONFIRM == showType) {
				var message = simpleChinesePrompt; //提示信息(目前只取简体中文);
				var messageType = simpleChinesetype; //提示信息类型0代表非表达式，1代表表达式
				if (message != null && "1" == messageType) {
					var message = vds.expression.execute(message,{
						"ruleContext": ruleContext
					});
				}
				if (message == null || String(message) == '') {
					throw new Error("请设置有效的提示信息");
				}
				message = String(message);
				if (message != '' && (message.substring(0, 1) == "\"" || message.substring(0, 1) == "'")) {
					message = message.substring(1);
				}
				if (message != '' && (message.substring(message.length - 1, message.length) == "\"" || message.substring(message.length - 1, message.length) == "'")) {
					message = message.substring(0, message.length - 1);
				}
				var promise = vds.message.info(message);
				promise.then(callback).catch(reject)
			} else {
				setBusinessRuleResult(ruleContext, isChanged, userConfirm);
				ruleContext.setRuleStatus(true);
				ruleContext.fireRouteCallback();
				resolve();
			}
		}catch(e){
			reject(e);
		}
	})
}

var hasChanged = function(datasourceName){ 
	var datasource = vds.ds.lookup(datasourceName);
	var rds = datasource.getInsertedRecords();
	if(rds.size()>0){
		return true;
	}
	rds = datasource.getUpdatedRecords();
	if(rds.size()>0){
		return true;
	}
	rds = datasource.getDeletedRecords();
	if(rds.size()>0){
		return true;
	}
	return false;
}
export{    main}