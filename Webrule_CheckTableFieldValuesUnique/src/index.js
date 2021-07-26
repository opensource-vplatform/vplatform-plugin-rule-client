/**
 * 检查表中字段数值的唯一性
 */

vds.import("vds.ds.*", "vds.expression.*", "vds.log.*", "vds.message.*", "vds.string.*");

var main = function (ruleContext) {
	return new Promise(function (resolve, reject) {
		try {
			var inParamsObj = ruleContext.getVplatformInput();
			var returnValue = true; //处理此规则时，记录是否中断业务规则不再往下执行，返回true:不中断，false:中断
			var userConfirm = true;
			var dsName = inParamsObj["tableName"];
			var message = inParamsObj["msg"]; //提示信息
			var type = inParamsObj["type"]; //信息类型:1.表达式、0.提示字符串
			var messageType = inParamsObj["messageType"]; //0返回结果，1提示，继续执行 2警告，继续执行 3错误，不能继续 4询问（确定/取消），根据用户选择继续或终止
			var fields = inParamsObj["field"];
			var fieldsNameMap = parseFieldsMessage(dsName);
			var isExist = false; // 是否存在相同数据标识
			var checkResult = [];
			checkResult = checkSetRecordData(dsName, fields, fieldsNameMap);

			//如果数据已经存在，先提示信息，再按照要求的中断类型，是否继续判断或者中断操作
			if (checkResult && checkResult.length > 0) {
				isExist = checkResult[0];
				var checkResultObj = checkResult[1];
				var hasTheSameValueInDB = checkResult[2];
				if (isExist) {
					var checkMsgs = "";
					if (hasTheSameValueInDB) {
						checkMsgs = "界面记录重复:\n";
						for (var key in checkResultObj) {
							var count = checkResultObj[key].length;
							if (count > 1) {
								checkMsgs = checkMsgs + "重复值:" + key + " 记录数:" + count + "\n";
							}
						}
					} else {
						checkMsgs = "界面上有1条记录和后台表重复:\n";
						for (var key in checkResultObj) {
							var count = checkResultObj[key].length;
							if (count > 1) {
								checkMsgs = checkMsgs + "重复值:" + key + " 记录数:" + (count - 1) + "\n";
							}
						}
					}
					var retMsg = "";
					var logMsg = ""
					if (vds.string.isEmpty(message)) {
						retMsg = "无配置提示信息";
						logMsg = "无配置提示信息";
					} else {
						if (type == "1") {
							var count = 1; // 大于10行用省略号
							for (var key in checkResultObj) {
								var arr = checkResultObj[key];
								if (arr.length > 1) {
									for (var i = 0; i < arr.length; i++) {
										if (arr[i] == "backRecord") { //后台有重复记录，只提示前台记录
											break;
										}
										var record = arr[i];
										var tmpStr = vds.expression.execute(message, { "ruleContext": ruleContext, "records": [record] });
										if (tmpStr == null || tmpStr == "" || logMsg.indexOf(tmpStr) >= 0)
											continue;
										if (logMsg != "" && logMsg.length() > 0)
											logMsg += "\n";
										logMsg += tmpStr;

										count++;
										if (count == 10) {
											retMsg = logMsg + "\n .................."
										}

									}
								}
							}
							if (count < 10) {
								retMsg = logMsg;
							}
						} else {
							retMsg = message;
							logMsg = message;
						}
					}
					//以log形式提示比较细则信息
					vds.log.log(checkMsgs + logMsg);

					var callback = function (val) {
						userConfirm = typeof (val) == "boolean" ? val : userConfirm;
						setBusinessRuleResult(ruleContext, !isExist, userConfirm);
						resolve();
					}
					if (messageType == 0) { //不提示，直接返回验证结果
						setBusinessRuleResult(ruleContext, !isExist, userConfirm);
						resolve();
					} else {
						if (messageType == 1) { //提示，继续执行
							var promise = vds.message.info(retMsg);
							promise.then(callback);
						} else if (messageType == 2) { //警告，继续执行
							var promise = vds.message.warn(retMsg);
							promise.then(callback);
						} else if (messageType == 3) { //错误，不能继续
							var promise = vds.message.error(retMsg);
							promise.then(callback);
							returnValue = true; //不中断执行，验证结果由业务返回值返回
						} else if (messageType == 4) { //询问（确定/取消），根据用户选择继续或终止
							var promise = vds.message.confirm(retMsg);
							promise.then(callback);
						} else {
							alert("--------------------");
						}
					}
				} else {
					setBusinessRuleResult(ruleContext, !isExist, userConfirm);
					resolve();
				}
			}
			else {
				resolve();
			}
			return true; //不中断执行，规则总是返回true
		} catch (ex) {
			reject(ex);
		}
	});
};

/**
 * 设置业务返回结果
 */
function setBusinessRuleResult(ruleContext, result, userConfirm) {
	if (ruleContext.setResult) {
		ruleContext.setResult("isUnique", result);     //业务返回结果：表中字段数值是否满足唯一性约束
		ruleContext.setResult("confirm", userConfirm); //业务返回结果：用户选择继续还是终止
	}
}

/**
 * 集合型的控件,对发生改变的记录进行判断
 * 1、发生改变的记录与当前组件的所有页面DB中记录进行对比，如果出现重复的字段，则进行提示
 * 2、若页面DB中记录没有重复的，然后再去在后台进行查找看有没有重复的
 */
var checkSetRecordData = function (dsName, judgeField, fieldsNameMap) {
	var checkResult = [];
	var isExist = false;
	var checkResultObj = {};
	//发生改变的记录集
	var changeRecords = [];
	var changeRecordDeletes = []; //记录已删除的，第二步检查时不用再检查已删除的记录
	var datasource = vds.ds.lookup(dsName);
	//删除记录
	var deleteRecords = datasource.getDeletedRecords();
	deleteRecords.iterate(function (record, num) {
		changeRecordDeletes.push(record);
	});
	//新增记录
	var insertRecords = datasource.getInsertedRecords();
	insertRecords.iterate(function (record, num) {
		changeRecords.push(record);
	});
	//更新的记录
	var updateRecords = datasource.getUpdatedRecords();
	updateRecords.iterate(function (record, num) {
		changeRecords.push(record);
	});

	//页面DB中的记录集
	var records = datasource.getAllRecords().toArray();
	//对发生改变的记录进行判断
	//判断过程:有1、2
	//1、发生改变的记录与当前组件的所有页面DB中记录进行对比，如果出现重复的字段，则进行提示
	var hasTheSameValueInDB = false; //在所有页面DB中记录是否已存在重复
	if (null != records && records.length > 0) {
		for (var i = 0; i < records.length; i++) {
			var record = records[i];
			var value = "";
			for (var t = 0; t < judgeField.length; t++) {
				var field = judgeField[t];
				var valTemp = record.get(field);
				if ("null" == valTemp) {
					valTemp = "\"null\"";
				}
				if (valTemp == null || valTemp == "") {
					valTemp = "";
				}
				if (valTemp != null && vds.string.trim(valTemp + "") == "" && (valTemp + "").length > 0) {
					valTemp = "\"" + valTemp + "\"";
				}
				var valueTemp = "" + valTemp;

				if (value == "") {
					if (valueTemp == "") {
						value = field + "为空";
					} else {
						value = field + "=" + valueTemp;
					}
				} else {
					if (valueTemp == "") {
						value = value + "," + field + "为空";
					} else {
						value = value + "," + field + "=" + valueTemp;
					}
				}
			}
			if (undefined != checkResultObj[value] || null != checkResultObj[value]) {
				// 如果在_array中已经存在，表示该列表中该字段已经有相同的值了
				hasTheSameValueInDB = true;
				checkResultObj[value].push(record);
			} else {
				// 直接使用字段值作为key，如果下次有相同的值，表示重复
				checkResultObj[value] = [record];
			}
		}
	}
	if (hasTheSameValueInDB) {
		isExist = true;
	}
	checkResult[0] = isExist;
	checkResult[1] = checkResultObj;
	checkResult[2] = hasTheSameValueInDB;
	return checkResult;
}

/**
 * 处理字段信息，如果配置了字段中文名称显示中文名称，没有配置中文名称显示英文名称
 */
var parseFieldsMessage = function (dsName) {
	var datasource = vds.ds.lookup(dsName);
	var metadata = datasource.getMetadata();
	var metadataFields = metadata.getFields();
	var fieldsNameMap = {};
	for (var i = 0; i < metadataFields.length; i++) {
		var fieldObj = metadataFields[i];
		var value = "";
		if (vds.string.isEmpty(fieldObj.getName())) {
			value = dsName + "." + fieldObj.getCode();
		} else {
			value = fieldObj.getName();
		}
		fieldsNameMap[dsName + "." + fieldObj.getCode()] = value;
	}
	return fieldsNameMap;
};

export { main }