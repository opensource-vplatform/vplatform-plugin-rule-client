/**
 * 删除实体记录
 */

vds.import("vds.ds.*", "vds.exception.*", "vds.expression.*");

var main = function (ruleContext) {
	return new Promise(function (resolve, reject) {
		try {
			var deleteParams = ruleContext.getVplatformInput();
			var dsName = deleteParams["TableName"];
			var condition = deleteParams["Condition"];
			//删除方式，0表示删除当前选中记录,1表示删除指定条件记录(条件为空时删除所有的)，如果删除方式为空,默认为删除当前选中记录
			var deleteType = deleteParams["deleteType"];
			var entityType = deleteParams["EntityType"];
			//根据类型获取数据源
			var datasource = getDataSource(dsName, entityType, ruleContext);
			var removeIds = getRemoveIds(datasource, condition, deleteType, ruleContext);
			if (undefined != removeIds && null != removeIds && removeIds.length > 0) {
				// 删除数据
				datasource.deleteRecordByIds(removeIds);
			}
			resolve();
		} catch (ex) {
			reject(ex);
		}
	});
};

/**
 * 获取主表删除的id
 * @param datasource 待删除数据源
 * @param condition 条件
 * @param deleteType 删除方式
 * @param deleteType 规则上下文
 */
var getRemoveIds = function (datasource, condition, deleteType, ruleContext) {
	//删除方式，0表示删除当前选中记录,1表示删除指定条件记录(条件为空时删除所有的),如果删除方式为空，默认为删除当前选中记录
	if (deleteType == null)
		deleteType = "0";

	var removeIds = [];
	//0表示删除当前选中记录
	if (deleteType == "0" || deleteType == 0) {
		var retRecords = datasource.getSelectedRecords().toArray();
		// 取选中行
		// 遍历数据取主键id
		if (undefined != retRecords && null != retRecords && retRecords.length > 0) {
			for (var rowsIndex = 0; rowsIndex < retRecords.length; rowsIndex++) {
				removeIds.push(retRecords[rowsIndex].getSysId());
			}
		}
	} else if (deleteType == "1" || deleteType == 1) {
		//1表示删除指定条件记录
		var records = datasource.getAllRecords().toArray();
		if (undefined != records && null != records && records.length > 0) {
			for (var index = 0; index < records.length; index++) {
				var record = records[index];
				var id = record.getSysId();
				//条件为空时删除所有的
				if (condition == null || condition.length == 0) {
					removeIds.push(id);
					continue;
				}
				var ret = vds.expression.execute(condition, { "ruleContext": ruleContext, "records": [record] });
				if (typeof ret != "boolean") {
					throw vds.exception.newConfigException("条件必须返回布尔类型，请检查");
				}
				if (ret == true) {
					removeIds.push(id);
				}
			}
		}
	}

	return removeIds;
};

/**
 * 获取数据源
 * @param dsName 数据源名称
 * @param entityType 实体类型
 * @param ruleContext 规则上下文
 */
var getDataSource = function (dsName, entityType, ruleContext) {
	var datasource = null;
	if (undefined == entityType || entityType == "window") {
		datasource = vds.ds.lookup(dsName);
	} else {
		switch (entityType) {
			case "ruleSetInput":
				dsName = "BR_IN_PARENT." + dsName;
				break;
			case "ruleSetVar":
				dsName = "BR_VAR_PARENT." + dsName;
				break;
			case "ruleSetOutput":
				dsName = "BR_OUT_PARENT." + dsName;
				break;
		}
		datasource = vds.expression.execute(dsName, { "ruleContext": ruleContext });
	}
	if (!datasource) {
		throw new Error("规则[DeleteListSelectRow]：找不到参数中的实体！" + dsName);
	}
	return datasource;
}

exports.main = main;

export { main }