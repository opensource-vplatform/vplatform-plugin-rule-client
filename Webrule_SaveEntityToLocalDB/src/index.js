/**
 *  保存实体数据到手机本地数据库
 */
vds.import("vds.ds.*","vds.expression.*","vds.exception.*","vds.rpc.*","vds.tree.*");
/**
 * 规则入口
 */
var main = function (ruleContext) {
	return new Promise(function (resolve, reject) {
		try {
			var paramsJson = ruleContext.getVplatformInput();
			if (!paramsJson) { //建议兼容
				paramsJson = "";
			}
			var isSuccess = true; // 用于记录保存是否成功
			var treeStructMapArray = paramsJson["treeStruct"];
			var treeMap = {};
			if (treeStructMapArray instanceof Array) {
				for (var i = 0, len = treeStructMapArray.length; i < len; i++) {
					var treeStruct = treeStructMapArray[i];
					var entityName = treeStruct["tableName"];
					if(entityName){
						var struct = vds.tree.createTreeStruct(entityName, treeStruct["pidField"],
							treeStruct["orderField"],treeStruct["treeCodeField"],treeStruct["isLeafField"],treeStruct["busiFilterField"])
						treeMap[entityName] = struct;
					}
				}
			}
			var dataSourceMappings = paramsJson["dataSourceMap"];
			var configs = [];
			if (undefined != dataSourceMappings && null != dataSourceMappings) {
				for (var i = 0; i < dataSourceMappings.length; i++) {
					var dataSourceMapping = dataSourceMappings[i];
					//是否保存所有，否则只保存改变的数据，为布尔值，如果是旧规则值为undefined
					var isSaveAll = dataSourceMapping["isSaveAll"];
					//兼容旧规则处理，默认为true
					if (isSaveAll == null || isSaveAll == undefined) {
						isSaveAll = true;
					}
					//源数据源（可能为内存表、查询或物理表）
					var dataSourceName = dataSourceMapping["dataSource"];
					var dataSourceNameType = dataSourceMapping["dataSourceType"]; //获取实体类型
					if (null != dataSourceName) {
						/*给实体添加前缀*/
						var datasource = getDatasouce(dataSourceName, dataSourceNameType, ruleContext);
						var newFieldMappings = [];
						var fileMappings = dataSourceMapping["dataMap"];
						if (fileMappings instanceof Array) {
							for (var i = 0, len = fileMappings.length; i < len; i++) {
								var map = fileMappings[i];
								var field = map.colName;
								if (field.indexOf(".") != -1) {
									field = field.split(".")[1];
								}
								var value = map.colValue;
								var type = map.valueType;
								if (type == "entityField") {
									type = "field";
								} else {
									type = "expression";
								}
								newFieldMappings.push({
									"code": field,
									"value": value,
									"type": type
								});
							}
						}
						var tableCode = dataSourceMapping["destTab"];
						var config = {
							"entity": datasource,
							"tableCode": tableCode,
							"fieldMappings": newFieldMappings,
							"autoFieldMapping": dataSourceMapping.isFieldAutoMapping === true ? true : false,
							"saveAll": isSaveAll
						}
						if (treeMap[tableCode]) {
							config["treeStruct"] = treeMap[tableCode]
						}
						configs.push(config);
					}
				}
			}
			if (configs.length > 0) {
				var promise = vds.rpc.saveData(configs, ruleContext, {
					"isAsync": true,
					"isLocalDb": true
				});
				promise.then(resolve).catch(function (result) {
					var str = "保存映射关系失败!";
					alert(str + result.msg);
					isSuccess = false;
					reject(vds.exception.newSystemException(str + result.msg));
				});
			} else {
				resolve();
			}
		} catch (err) {
			reject(err);
		}
	});
}
/**
 * 获取来源数据源实例
 * @param {String} entityName 数据源编码
 * @param {String} entityType 数据源类型：ruleSetOutput（方法输出）、ruleSetInput（方法输入）、ruleSetVar（方法变量）
 * @param {@link RuleContext} ruleContext 规则上下文
 * @return {@link Datasource}
 */
function getDatasouce(entityName, entityType, ruleContext) {
	var dbName = entityName;
	var type = "";
	if (entityType == "ruleSetOutput") { //方法输出
		type = "BR_OUT_PARENT.";
	} else if (entityType == "ruleSetInput") { //方法输入
		type = "BR_IN_PARENT.";
	} else if (entityType == "ruleSetVar") { //方法变量
		type = "BR_VAR_PARENT.";
	} else {
		return vds.ds.lookup(entityName);
	}
	dbName = type + dbName;
	return vds.expression.execute(dbName, {
		"ruleContext": ruleContext
	});
}
export {
	main
}