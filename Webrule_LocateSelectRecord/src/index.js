/**
 * ============记录定位规则 规则说明： 1、规则只影响条件为true的记录；条件为true的记录视情况设置为选中、或者取消选中；
 * 2、条件为false的记录状态不变； 3、树的子节点不会被级联设置； 4、如果条件未设置（为空），则意味着针对所有记录；
 */
vds.import("vds.ds.*","vds.expression.*","vds.exception.*", "vds.string.*");
/**
 * 规则入口
 */
var main = function (ruleContext) {
	return new Promise(function (resolve, reject) {
		try {
			var inParams = ruleContext.getVplatformInput();
			// 源实体编码
			var sourceName = inParams.sourceName;
			// 源实体过滤条件
			var condition = inParams.condition;
			// 是否需要选中
			var isSelect = inParams.isSelect;

			var datasource = vds.ds.lookup(sourceName);
			if (!datasource) {
				reject(vds.exception.newConfigException("来源实体【" + sourceName + "】不存在，请检查配置."));
				return;
			}
			// 取下一条实体记录
			var locateAllRecord = _getAllLocateEntityRecord(sourceName, condition, ruleContext);

			if (locateAllRecord.length > 0) {
				var datasource = vds.ds.lookup(sourceName);
				if(isSelect === true){
					datasource.selectRecords(locateAllRecord);
				}else{
					datasource.unSelectRecords(locateAllRecord);
				}
			}
			resolve();
		} catch (err) {
			reject(err);
		}
	});
}
/**
 * 获取符合条件的记录
 * @param {String} sourceName 数据源名称
 * @param {String} condition 过滤条件
 * @param {RuleContext} ruleContext 规则上下文
 * @return {Array<Record>} 符合条件的记录列表
 */
var _getAllLocateEntityRecord = function (sourceName, condition, ruleContext) {
	// 源记录集合
	var datasource = vds.ds.lookup(sourceName);
	if (!datasource) {
		throw vds.exception.newConfigException("来源实体【" + sourceName + "】不存在，请检查配置.");
	}
	var records = datasource.getAllRecords();
	if (records)
		records = records.toArray();

	if (condition == null || vds.string.trim(condition) === '') {
		return records;
	}

	// 过滤后的记录集合
	var results = [];
	for (var i = 0; i < records.length; i++) {
		var record = records[i];
		try {
			var ret = vds.expression.execute(condition, {
				"records": [record],
				"ruleContext": ruleContext
			});
			if (typeof ret != "boolean") {
				throw vds.exception.newConfigException("条件必须返回布尔类型");
			}
			// 条件满足
			if (ret == true) {
				results.push(record);
			}
		} catch (e) {
			var message = "表达式执行错误！condition=" + condition + "错误信息：" + e.message;
			vds.log.error(message);
			throw vds.exception.newConfigException("实体过滤条件不正确！" + message);
		}
	}
	return results;
};

export {
	main
}