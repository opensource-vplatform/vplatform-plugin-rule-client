/**
 * 刷新组件内系统变量的值
 */
vds.import("vds.component.*");
/**
 * 规则入口
 */
var main = function (ruleContext) {
	return new Promise(function (resolve, reject) {
		try {
			var inParamsObj = ruleContext.getVplatformInput();
			var systemVarNames = inParamsObj["systemVarNames"]; // 赋值字段的fieldName
			if (undefined != systemVarNames && null != systemVarNames && systemVarNames.length > 0) {
				vds.component.refreshVariant(systemVarNames);
			}
			resolve();
		} catch (err) {
			reject(err);
		}
	});
}
export{    main}