/**
 *	给循环变量赋值
 */
vds.import("vds.exception.*","vds.expression.*");
/**
 * 规则入口
 */
var main = function (ruleContext) {
	return new Promise(function (resolve, reject) {
		try {
			var inParamObj = ruleContext.getVplatformInput();
			var varCode = inParamObj.LoopVar;
			var entity = inParamObj.LoopEntity;
			var fields = inParamObj.Fields;
			var datasource = ruleContext.getForEachObj(varCode);
			if (datasource) {
				var record = ruleContext.getForEachVar(varCode);
				if (fields && fields.length > 0) {
					for (var i = 0, l = fields.length; i < l; i++) {
						var fieldInfo = fields[i];
						var value = vds.expression.execute(fieldInfo.Source, {
							"ruleContext": ruleContext
						});
						record.set(fieldInfo.LoopVarField, value)
					}
					datasource.updateRecords([record]);
				}
				resolve();
			} else {
				reject(vds.exception.newConfigException("实体[" + entity + "]不存在"));
				return;
			}
		} catch (err) {
			reject(err);
		}
	});
}
export {
	main
}