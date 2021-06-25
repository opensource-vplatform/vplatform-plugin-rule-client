/**
 * 控件属性设置
 */
vds.import("vds.string.*","vds.widget.*", "vds.exception.*","vds.expression.*");
/**
 * 规则入口
 */
var main = function (ruleContext) {
	return new Promise(function (resolve, reject) {
		try {
			var inParamsObj = ruleContext.getVplatformInput();
			var conditions = inParamsObj["condition"];
			if (!conditions || conditions.length < 1){
				resolve();
				return;
			}
			for (var tmp = 0; tmp < conditions.length; tmp++) {
				var condition = conditions[tmp];
				var formula = condition["name"] //条件
				var items = condition["items"];
				var isFormula = false;
				try {
					isFormula = vds.expression.execute(formula,{
						"ruleContext": ruleContext
					});
				} catch (e) {
					reject(vds.exception.newConfigException("表达式" + formula + "不正确，请检查！"));
					return;
				}
				if(isFormula !== true || !items || items.length < 1){
					continue;
				}
				for (var index = 0; index < items.length; index++) {
					var item = items[index];
					var controlID = item["controlCode"]; //控件ID
					var propertyCode = item["propertyCode"]; // 要更改的属性ID
					var values = item["values"]; //期望值
					var valueType = item["valuetype"]; //期望值类型
					//根据属性ID得到属性名PropertyCode
					if (!vds.string.isEmpty(values) && valueType == "1") {
						values = vds.expression.execute(values,{
							"ruleContext": ruleContext
						});
					}
					vds.widget.setProperty(controlID, propertyCode, values);
				}
			}
			resolve();
		} catch (err) {
			reject(err);
		}
	});
}
export {
	main
}