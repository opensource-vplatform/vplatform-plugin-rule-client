/**
 *	修改数据库中的记录
 */
 vds.import("vds.ds.*","vds.exception.*","vds.expression.*","vds.window.*","vds.component.*","vds.widget.*","vds.log.*","vds.string.*","vds.rpc.*")
/**
 * 规则入口
 */
var main = function (ruleContext) {
	return new Promise(function (resolve, reject) {
		try {
			var inParams = ruleContext.getVplatformInput();
			if (!inParams) {//建议兼容
				inParams = "";
			}
			var dataSourcesMapping = null;
			dataSourcesMapping = inParams["dataSourcesMapping"];
			var methodContext = ruleContext.getMethodContext();
			//如果存在映射关系则生成目标映射表保存数据进行保存
			if (undefined != dataSourcesMapping && null != dataSourcesMapping) {
				var parsedDatas = [];
				for (var i = 0; i < dataSourcesMapping.length; i++) {
					var dataSourceMapping = dataSourcesMapping[i];
					var currData = {};
					currData["dataSource"] = dataSourceMapping["dataSource"];
					var condition = dataSourceMapping["condition"];
					var wrParam = {
						"type": vds.ds.WhereType.Query,
						"methodContext": methodContext
					};
					var w = vds.ds.createWhere(wrParam);
					if (undefined != condition && null != condition && condition.length > 0) {
						w.addCondition(condition);
					}
					currData["condition"] = w.toWhere();
					currData["parameters"] = w.toParameters();
					currData["values"] = [];
					var dataMap = dataSourceMapping["dataMap"];
					for (var k = 0; k < dataMap.length; k++) {
						var currMap = dataMap[k];
						var colValue = currMap["colValue"];
						var valueType = currMap["valueType"];
						var value;
						var currValueObject = {};
						switch (valueType) {
							case "0": //界面实体
								var tempTabName = colValue.substring(0, colValue.indexOf("."));
								var tempColName = colValue.substring(colValue.indexOf(".") + 1, colValue.length);
								var datasource = vds.ds.lookup(tempTabName);
								if (!datasource) {
									throw vds.exception.newConfigException("实体【" + tempTabName + "】不存在，请检查.");
								}
								var curValue = datasource.getCurrentRecord();
								if (curValue) {
									value = curValue.get(tempColName);
								}
								break;
							case "expression": //表达式
								value = vds.expression.execute(colValue, {
									"ruleContext": ruleContext
								});
								break;
							case "2": //组件变量
								value = vds.window.getInput(colValue);
								break;
							case "3": //系统变量
								value = vds.component.getVariant(colValue);
								break;
							case "4": //控件
								value = vds.widget.execute(colValue, "getValue");
								break;
							case "5": //固定值
								value = colValue;
								break;
							case "6": //SQL表达式
								value = vds.expression.execute(colValue, {
									"ruleContext": ruleContext
								});
								break;
							default:

								break;
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
				if (parsedDatas.length > 0) {
					var params = {};
					params.condParams = parsedDatas;

					var callback = function (responseObj) {
						var success = responseObj.Success
						resolve();
						return success;
					};
					var errorCallback = function (responseObj) {
						if (responseObj && responseObj.message)
							vds.log.error(responseObj.message);
						reject(responseObj);
					};
					var commitParams = [{
						"code": "InParams",
						"type": "char",
						"value": vds.string.toJson(params)
					}];
					var promise = vds.rpc.callCommand("CommonRule_ModifyDataBaseRecord", commitParams, {
						"isAsync": true,
						"ruleContext":ruleContext
					});
					promise.then(callback).catch(errorCallback);
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