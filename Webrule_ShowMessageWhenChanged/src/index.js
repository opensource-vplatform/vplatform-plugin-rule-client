/**
 * 判断指定的数据源是否发生变化
*/
vds.import("vds.object.*","vds.exception.*","vds.expression.*","vds.message.*","vds.ds.*");
var SHOWTYPE_CONFIRM = "1"; // 1:询问（确定/取消），根据用户选择继续或终止
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
				resolve();
			}
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
					reject(vds.exception.newConfigException("请设置有效的提示信息"));
					return;
				}
				message = String(message);
				if (message != '' && (message.substring(0, 1) == "\"" || message.substring(0, 1) == "'")) {
					message = message.substring(1);
				}
				if (message != '' && (message.substring(message.length - 1, message.length) == "\"" || message.substring(message.length - 1, message.length) == "'")) {
					message = message.substring(0, message.length - 1);
				}
				var promise = vds.message.confirm(message);
				promise.then(callback).catch(reject)
			} else {
				setBusinessRuleResult(ruleContext, isChanged, userConfirm);
				resolve();
			}
		}catch(e){
			reject(e);
		}
	})
}
/**
 * 设置规则返回结果
 * @param {RuleContext} ruleContext 规则上下文
 * @param {Boolean} result 是否改变
 * @param {Boolean} userConfirm 确认或取消
 */
function setBusinessRuleResult(ruleContext, result, userConfirm) {
	if (ruleContext.setResult) {
		ruleContext.setResult("isChanged",result);
		ruleContext.setResult("confirm",userConfirm);
	}
}
/**
 * 判断数据源是否有变化
 * @param {String} datasourceName 数据源编码
 * @returns {Boolean}
 * 
*/
var hasChanged = function(datasourceName){ 
	var datasource = vds.ds.lookup(datasourceName);
	var rds = datasource.getInsertedRecords();//获取新增记录
	if(rds.size()>0){
		return true;
	}
	rds = datasource.getUpdatedRecords();//获取更新记录
	if(rds.size()>0){
		return true;
	}
	rds = datasource.getDeletedRecords();//获取删除记录
	if(rds.size()>0){
		return true;
	}
	return false;
}
export{    main}