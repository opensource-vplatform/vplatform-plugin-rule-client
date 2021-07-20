/**
 * 界面实体之间数据比较
 */

vds.import("vds.ds.*", "vds.expression.*", "vds.log.*", "vds.string.*");

var main = function (ruleContext) {
	return new Promise(function (resolve, reject) {
		try {
			//当任何一条匹配数据不满足比较条件时，返回false，否则返回true(包括两种情况：不存在匹配数据或所有匹配数据都满足比较条件)；
			var bussinessReturnValue = true;
			var params = ruleContext.getVplatformInput();
			var srcDataSource = params["srcDataSource"];
			var destDataSource = params["destDataSource"];
			var srcFilterCondition = params["srcFilterCondition"];
			var matchFields = params["matchFields"];
			var compareCondition = params["compareCondition"];

			if (compareCondition == null) {
				throw new Error("比较条件配置不能为空，请检查配置！");
			}

			var srcCompareField = compareCondition["srcField"];
			var destCompareField = compareCondition["destField"];
			var isMergeRepeatData = compareCondition["isMergeRepeatData"];
			var operator = compareCondition["compareOperator"];

			srcCompareField = getFieldName(srcCompareField);
			destCompareField = getFieldName(destCompareField);

			if (operator == null || operator == "") {
				throw new Error("比较操作符不能为空，请检查配置！");
			}
			if (srcCompareField == null || srcCompareField == "") {
				throw new Error("源实体比较字段不能为空，请检查配置！");
			}
			if (destCompareField == null || destCompareField == "") {
				throw new Error("目标实体比较字段不能为空，请检查配置！");
			}

			//源实体比较字段类型必须与目标实体比较字段类型兼容
			var stringTypeArray = ["char", "text", "longDate"];
			var numberTypeArray = ["integer", "number"];
			var srcCompareFieldType = getFieldTypeByDataSource(srcDataSource, srcCompareField);
			var destCompareFieldType = getFieldTypeByDataSource(destDataSource, destCompareField);
			var isCompareAllow = true;
			var isCompareBothNumber = false;
			if (srcCompareFieldType != destCompareFieldType) {
				isCompareAllow = false;
				if (vds.string.isInArray(srcCompareFieldType, stringTypeArray) &&
					vds.string.isInArray(destCompareFieldType, stringTypeArray)) {
					isCompareAllow = true;
				}
				if (vds.string.isInArray(srcCompareFieldType, numberTypeArray) &&
					vds.string.isInArray(destCompareFieldType, numberTypeArray)) {
					isCompareAllow = true;
					isCompareBothNumber = true;
				}
			}
			if (srcCompareFieldType == "file" || srcCompareFieldType == "blob" ||
				destCompareFieldType == "file" || destCompareFieldType == "blob") {
				throw new Error("源实体比较字段与目标实体比较字段类型不不支持，请检查配置！");
			}
			if (!isCompareAllow) {
				throw new Error("源实体比较字段与目标实体比较字段类型不兼容，请检查配置！");
			}

			var result = params["result"];
			var isSave = result["isSave"];
			var isClearSaveData = result["isClearSaveData"];
			var saveDataSource = result["saveDataSource"];
			var mappings = result["mappings"];


			if (vds.string.isEmpty(srcDataSource) || vds.string.isEmpty(destDataSource)) {
				throw new Error("源实体或物理表及查询不能为空，请检查配置！");
			}

			if (srcDataSource != destDataSource) {
				var errorMsg = null;
				if (matchFields == null || matchFields.length == 0) {
					errorMsg = "匹配字段不能为空，请检查配置！";
				}
				for (var i = 0; i < matchFields.length; i++) {
					var obj = matchFields[i];
					if (obj == null) {
						errorMsg = "匹配字段不能为空，请检查配置！";
						break;
					}
					if (vds.string.isEmpty(obj["srcField"])) {
						errorMsg = "匹配源字段不能为空，请检查配置！";
						break;
					}
					if (vds.string.isEmpty(obj["destField"])) {
						errorMsg = "匹配目标字段不能为空，请检查配置！";
						break;
					}

				}
				if (errorMsg != null) {
					throw new Error(errorMsg);
				}
			}

			if (isSave) {
				if (vds.string.isEmpty(saveDataSource)) {
					throw new Error("存储实体不能为空，请检查配置！");
				}
				if (mappings == null || mappings.length == 0) {
					throw new Error("存储实体字段映射不能为空，请检查配置！");
				}
				if (saveDataSource == srcDataSource || saveDataSource == destDataSource) {
					throw new Error("存储实体不能为源实体或目标实体，请检查配置！");
				}
			}
			if (srcDataSource == destDataSource && srcCompareField == destCompareField) {
				throw new Error("源实体与目标实体相同时比较字段不能相同，请检查配置！");
			}
			var srcRecords = getFilterRecords(srcDataSource, srcFilterCondition, ruleContext);
			var destRecords = getFilterRecords(destDataSource, null, ruleContext);
			if (srcRecords == null || srcRecords.length == 0 || destRecords == null || destRecords.length == 0) {
				if (isSave && isClearSaveData) {
					var ds = vds.ds.lookup(saveDataSource);
					ds.clear();
				}
				setBusinessRuleResult(ruleContext, true);
				resolve();
				return true;
			}

			var finalResults = [];

			//源实体和目标实体相同时
			if (srcDataSource == destDataSource) {

				for (var i = 0; srcRecords != null && i < srcRecords.length; i++) {
					var srcCompareFieldVal = srcRecords[i][srcCompareField];
					var destCompareFieldVal = srcRecords[i][destCompareField];
					var compareRst = exeCompare(isCompareBothNumber, srcCompareFieldVal, operator, destCompareFieldVal);
					if (compareRst) {

						finalResults.push(srcRecords[i]);
					}
				}

			} else {
				var isAllMatchData = true;//存在的匹配数据全部都对比通过
				var isExistMatchData = false;//是否存在匹配数据
				var srcMatchFields = [];
				var destMatchFields = [];
				for (var i = 0; i < matchFields.length; i++) {
					srcMatchFields.push(matchFields[i].srcField);
					destMatchFields.push(matchFields[i].destField);
				}
				var srcRecordsMap = getRecordsMapByGroupFields(srcRecords, srcMatchFields);
				try {
					var destRecordsMap = getRecordsMapByGroupFields(destRecords, destMatchFields, true);
					for (var srcGroupKey in srcRecordsMap) {
						var srcValues = srcRecordsMap[srcGroupKey];
						var destGroupKey = getDestGroupKeyStr(srcGroupKey, matchFields);
						var destValues = destRecordsMap[destGroupKey];

						if (srcValues == null || srcValues.length == 0 ||
							destValues == null || destValues.length == 0) {
							continue;
						} else {
							isExistMatchData = true;
						}
						var destCompareFieldVal = destValues[0][destCompareField];
						for (var j = 0; j < srcValues.length; j++) {
							var srcCompareFieldVal = srcValues[j][srcCompareField];
							if (srcValues.length > 1 && isMergeRepeatData) {
								if (!vds.string.isInArray(srcCompareFieldType, numberTypeArray)) {
									throw new Error("源实体匹配记录有重复，比较字段不是整数或浮点类型，不能执行合并操作，请检查配置！");
								}
								srcCompareFieldVal = getSumValue(srcValues, [srcCompareField]);
							}
							var compareRst = exeCompare(isCompareBothNumber, srcCompareFieldVal, operator, destCompareFieldVal);
							if (compareRst) {
								var combineRecord = combineTwoRecord(srcDataSource, srcValues[j], destDataSource, destValues[0]);
								finalResults.push(combineRecord);
							} else {
								isAllMatchData = false;
							}
						}
					}
				} catch (e) {
					throw new Error("目标实体匹配记录不能重复，请检查配置！");
				}
			}

			if (isSave) {
				if (isClearSaveData) {
					var ds = vds.ds.lookup(saveDataSource);
					ds.clear();
				}
				//获取构造的存储实体数据
				if (finalResults != null && finalResults.length > 0) {
					var newSaveRecords = getCopyRecordsByMapping(saveDataSource, finalResults, mappings);
					var datasource = vds.ds.lookup(saveDataSource);
					datasource.insertRecords(newSaveRecords);
				}
			}

			if (finalResults != null && isAllMatchData && isExistMatchData)
				bussinessReturnValue = true;
			else
				bussinessReturnValue = false;
			setBusinessRuleResult(ruleContext, bussinessReturnValue);

			resolve();

			return true;
		} catch (ex) {
			reject(ex);
		}
	});
};

function setBusinessRuleResult(ruleContext, result) {
	if (ruleContext.setResult) {
		ruleContext.setResult("isMatchCompare", result);
	}
}

var getDestGroupKeyStr = function (srcGroupKeyStr, matchFields) {
	var destGrouKeyStr = srcGroupKeyStr;
	for (var i = 0; i < matchFields.length; i++) {
		destGrouKeyStr = destGrouKeyStr.replace(matchFields[i].srcField, matchFields[i].destField);
	}
	return destGrouKeyStr;
}

var combineTwoRecord = function (srcDataSource, srcRecord, destDataSource, destRecord) {
	var newRecord = {};
	var fields = "";
	for (var field1 in srcRecord) {
		var fieldName = field1;
		if (field1.indexOf(".") < 0)
			fieldName = srcDataSource + "." + field1;
		newRecord[fieldName] = srcRecord[field1];
		fields += fieldName + ","
	}
	for (var field2 in destRecord) {
		var fieldName = field2;
		if (field2.indexOf(".") < 0)
			fieldName = destDataSource + "." + field2;

		if (fields.indexOf(fieldName) >= 0)
			continue;
		newRecord[fieldName] = destRecord[field2];
	}
	return newRecord;
};

var getCopyRecordsByMapping = function (dataSource, records, mappingFields) {
	var datasource = vds.ds.lookup(dataSource);
	var copyRecords = [];
	for (var i = 0; i < records.length; i++) {
		var obj = datasource.createRecord();
		for (var j = 0; j < mappingFields.length; j++) {
			var resultFieldVal = records[i][mappingFields[j].resultField];
			if (resultFieldVal == null) {
				resultFieldVal = records[i][getFieldName(mappingFields[j].resultField)];
			}
			obj.set(getFieldName(mappingFields[j].saveField), resultFieldVal);
		}
		copyRecords.push(obj);
	}
	return copyRecords;
};


var getFieldTypeByDataSource = function (dataSource, fieldName) {
	var datasource = vds.ds.lookup(dataSource);
	var metadata = datasource.getMetadata();
	var fields = metadata.getFields();
	if (fields != null) {
		for (var i = 0; i < fields.length; i++) {
			var metaFieldName = fields[i].getCode();
			var b = fieldName.split(".");
			if (metaFieldName == fieldName) {
				return fields[i].getType();
			}
			if (b.length == 2 && metaFieldName == b[1]) {
				return fields[i].getType();
			}
		}
	}
	return "";
};

var exeCompare = function (isCompareBothNumber, val1, operator, val2) {
	if (isCompareBothNumber) {
		if (val1 == null)
			val1 = 0;
		if (val2 == null)
			val2 = 0;
	} else {
		if (val1 == null)
			val1 = "";
		if (val2 == null)
			val2 = "";
	}
	if (operator == "=")
		return val1 == val2;
	if (operator == "!=")
		return val1 != val2;
	if (operator == ">")
		return val1 > val2;
	if (operator == ">=")
		return val1 >= val2;
	if (operator == "<")
		return val1 < val2;
	if (operator == "<=")
		return val1 <= val2;
	throw new Error("不支持的操作符" + operator);
};

var getSumValue = function (records, fieldName) {
	var sum = 0;
	for (var i = 0; records != null && i < records.length; i++) {
		var val = records[i][fieldName];
		if (val != null)
			sum += val;
	}
	return sum;
};

var getRecordsMapByGroupFields = function (records, groupFieldNames, isCheckRepeat) {
	var map = {};
	if (records != null && groupFieldNames != null && groupFieldNames.length > 0) {
		for (var i = 0; i < records.length; i++) {
			var key = getGroupValueStr(records[i], groupFieldNames);
			if (key == null || key == "")
				continue;
			var objs = map[key];
			if (objs == null) {
				objs = new Array();
			}
			else if (isCheckRepeat) {
				vds.log.error("数据存在重复");
				throw new Error("数据存在重复");
			}
			objs.push(records[i]);
			map[key] = objs;
		}
	}
	return map;
};

var getGroupValueStr = function (record, groupFieldNames) {
	var groupVal = "";
	if (record != null && groupFieldNames != null && groupFieldNames.length > 0) {
		for (var i = 0; i < groupFieldNames.length; i++) {
			groupVal += groupVal.length > 0 ? "," : "";
			var fieldVal = record[getFieldName(groupFieldNames[i])];
			groupVal += groupFieldNames[i] + "=" + fieldVal;
		}
	}

	return groupVal;
};

/**
 *	根据源实体名称及拷贝类型来获取要拷贝的行数据
 *  @param	dataSource	源实体名称
 *  @param	condition	源实体条件
 */
var getFilterRecords = function (dataSource, condition, ruleContext) {
	var outputRecords = [];
	var datasource = vds.ds.lookup(dataSource);
	var records = datasource.getAllRecords();
	if (records)
		records = records.toArray();
	if (condition == null || condition == "")
		return _genDataMaps(records);
	if (records && records.length > 0) {
		for (var index = 0; index < records.length; index++) {
			var record = records[index];
			var ret = vds.expression.execute(condition, { "ruleContext": ruleContext, "records": [record] });
			if (typeof ret != "boolean") {
				vds.log.error("条件必须返回布尔类型，请检查");
				continue;
			}
			if (ret == true) {
				outputRecords.push(record.toMap());
			}
		}
	}
	return outputRecords;
};

var getFieldName = function (fieldName) {
	if (fieldName != null && fieldName.indexOf(".") > 0)
		return fieldName.split(".")[1];
	return fieldName;
};

var _genDataMaps = function (records) {
	if (!records || records.length == 0)
		return null;

	var result = [];
	for (var i = 0, len = records.length; i < len; i++)
		result.push(records[i].toMap())

	return result;
}

export { main }