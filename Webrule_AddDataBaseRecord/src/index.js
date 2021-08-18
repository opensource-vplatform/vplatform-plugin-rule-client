/**
 *	新增数据库中的记录
 */
vds.import("vds.rpc.*","vds.log.*","vds.exception.*","vds.expression.*","vds.string.*");
/**
 * 规则入口
 */
var main = function (ruleContext) {
	return new Promise(function (resolve, reject) {
		try {
			var inParams = ruleContext.getVplatformInput();
			if (!inParams) { //建议兼容
				inParams = "";
			}
			// var routeContext = ruleContext.getRouteContext();
			var dataSourcesMapping = inParams["dataSourcesMapping"];
			// var scope = scopeManager.getScope();

			//如果存在映射关系则生成目标映射表保存数据进行保存
			if (undefined != dataSourcesMapping && null != dataSourcesMapping) {
				var parsedDatas = [];
				for (var i = 0; i < dataSourcesMapping.length; i++) {
					var dataSourceMapping = dataSourcesMapping[i];
					var dataSourceName = dataSourceMapping["dataSource"];

					var currData = {};
					currData["dataSource"] = dataSourceName;
					currData["values"] = [];
					var dataMap = dataSourceMapping["dataMap"];
					for (var k = 0; k < dataMap.length; k++) {
						var currMap = dataMap[k];
						var colValue = currMap["colValue"];
						var valueType = currMap["valueType"];
						var value;
						var currValueObject = {};
						//现在的来源类型只能为expression
						if (valueType == "expression") {
							value = vds.expression.execute(colValue, {
								"ruleContext": ruleContext
							});
						}
						currValueObject["destField"] = currMap["colName"];
						currValueObject["sourceField"] = value;
						currValueObject["valueType"] = valueType;
						currData["values"].push(currValueObject);
					}
					//如果所有字段值都为空则不给予保存
					if (currData["values"].length > 0) {
						parsedDatas.push(currData);
					}
				}

				//如果没有需要保存的数据则不调用后台规则
				if (parsedDatas.length > 0) {
					var params = {};
					params.condParams = parsedDatas;
					params.dataSourcesMapping = dataSourcesMapping;

					// 调用完活动集之后的回调方法
					// var error = function (responseObj) {
					// 	logUtil.error(responseObj.message);
					// 	reject(vds.exception.newSystemException(responseObj.message));
					// 	// ruleContext.handleException(responseObj);
					// };
					// var successCallBack = function (responseObj) {

					// 	ruleContext.fireRouteCallback();
					// };
					//  调用后台活动集
					// var sConfig = {
					// 	"isAsyn": true,
					// 	"timeout": rpcEnum.TIMEOUT.SHORT,
					// 	"ruleSetCode": "CommonRule_AddDataBaseRecord",
					// 	commitParams: [{
					// 		"paramName": "InParams",
					// 		"paramType": "char",
					// 		"paramValue": jsonUtil.obj2json(params)
					// 	}]
					// }

					// var scopeId = scope.getInstanceId();
					// var windowScope = scopeManager.getWindowScope();
					// if (scopeManager.isWindowScope(scopeId)) {
					// 	sConfig.windowCode = windowScope.getWindowCode();
					// }
					var promise = vds.rpc.callCommand("CommonRule_AddDataBaseRecord", [{
						"code": "InParams",
						"type": "char",
						"value": vds.string.toJson(params)
					}], {
						"isAsyn": true,
						"ruleContext":ruleContext,
						"timeout": vds.rpc.Timeout.Short
					});
					promise.then(function () {
						resolve();
					}).catch(function (responseObj) {
						if (responseObj) {
							vds.log.error(responseObj.message);
							reject(vds.exception.newSystemException(responseObj.message));
						}
					});
				}
			}
		} catch (err) {
			reject(err);
		}
	});
}

export {
	main
}