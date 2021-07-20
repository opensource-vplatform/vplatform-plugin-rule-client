/**
 * 记录引用检查 <code>
 * {
 *	"sourceTable" : "Company", //
 *	"sourceField" : "Company.ID", // 检查值来源(当前组件实体/数据集)
 *	"checkTable" : "Contract",
 *  "Condition" : "Condition",//过滤条件
 *	"checkField" : "Contract.CompanyID" // 检查表(数据库表)
 * }
 * </code>
 * 
 * @return true 记录没有被引用
 * @return false 记录被其他表引用
 */
 vds.import("vds.ds.*","vds.exception.*","vds.string.*","vds.rpc.*")
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
			var dsName = inParamObj.sourceTable;
			var rows = getSelectedAndCurrentRecords(dsName);
			//如果要检查的数据源当前没有选中行，则检查通过，业务返回值为false[表示没有被引用]
			if (!rows || rows.length == 0) {
				setResult(ruleContext, false);
				return true;
			}
			var methodContext = ruleContext.getMethodContext();

			var params = {
				rowValues: [],
				condition: "",
				parameters: {}
			};
			// 构建查询条件
			var wrParam = {
				"type": vds.ds.WhereType.Query,
				"methodContext": methodContext
			};
			var w = vds.ds.createWhere(wrParam);
			var orConds = [];
			var sourceField = inParamObj.sourceField.split(".")[1];
			for (var i = 0; i < rows.length; i++) {
				var value = rows[i].get(sourceField);
				// 跳过空值不检查
				if (value != null) {
					params.rowValues.push(value);
					orConds.push({
						"code": inParamObj.checkField,
						"value": value
					});
				}
			}
			w.addOrConditions(orConds, w.NodeType.EQ);

			var condition = inParamObj.Condition;
			if (undefined != condition && null != condition && condition.length > 0) {
				w.addCondition(condition);
			}
			params.condition = w.toWhere();
			params.parameters = w.toParameters();
			params.checkTable = inParamObj["checkTable"];
			if (params.rowValues.length < 1) {
				setResult(ruleContext, false);
				resolve();
			} else {
				var callback = function (responseObj) {
					var result = responseObj.Success;
					setResult(ruleContext, result);
					resolve();
					return true;
				};
				var errorCallback = function (responseObj) {
					var result = responseObj.Success;
					reject(vds.exception.newSystemException("记录引用检查执行异常！" + result));
				};
				errorCallback = ruleContext.genAsynCallback(errorCallback);
				var promise = vds.rpc.callCommand("CommonRule_RecordReferenceCheck",[{
					"code": "InParams",
					"type": "char",
					"value": vds.string.toJson(params)
				}], {
					"isAsync": true,
				});
				promise.then(callback).catch(errorCallback);
			}
		} catch (err) {
			reject(err);
		}
	});
}
var getSelectedAndCurrentRecords = function (dsName) {
	var datasource = vds.ds.lookup(dsName);
	if (!datasource) {
		throw vds.exception.newConfigException("实体【" + dsName + "】不存在，请检查配置.");
	}
	var rd = datasource.getCurrentRecord();
	var rs = [];
	if (rd) {
		rs.push(rd);
	}
	var sel = datasource.getSelectedRecords();
	var iterator = sel.iterator();
	while (iterator.hasNext()) {
		var record = iterator.next();
		if (!rd || rd.getSysId() != record.getSysId()) {
			rs.push(record);
		}
	}
	return rs;
}
/**
 * 设置规则返回值
 * @param {RuleContext} ruleContext 规则上下文
 * @param {Any} value 值
 */
var setResult = function (ruleContext, value) {
	if (ruleContext.setResult) {
		ruleContext.setResult("isReferenced", value)
	}
}

export {
	main
}