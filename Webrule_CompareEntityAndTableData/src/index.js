/**
 *界面实体与物理表数据比较
 *
 */

vds.import("vds.component.*", "vds.ds.*", "vds.expression.*", "vds.log.*", "vds.object.*", "vds.rpc.*", "vds.string.*", "vds.widget.*", "vds.window.*");

// 规则主入口(必须有)
var main = function (ruleContext) {
	return new Promise(function (resolve, reject) {
		try {
			// 当任何一条匹配数据不满足比较条件时，返回false，否则返回true(包括两种情况：不存在匹配数据或所有匹配数据都满足比较条件)；
			var bussinessReturnValue = true;

			var params = ruleContext.getVplatformInput();
			var srcDataSource = params["srcDataSource"];
			var srcFilterCondition = params["srcFilterCondition"];
			var destDataSource = params["destDataSource"];
			var destIsQuery = params["destIsQuery"];
			var destFilterCondition = params["destFilterCondition"];
			var destQueryParams = params["destQueryParams"];

			var matchFields = params["matchFields"];

			var compareCondition = params["compareCondition"];

			if (compareCondition == null) {
				throw new Error("比较条件配置不能为空，请检查配置！");
			}

			var srcCompareField = compareCondition["srcField"];
			var destCompareField = compareCondition["destField"];
			var isMergeRepeatData = compareCondition["isMergeRepeatData"];
			var operator = compareCondition["compareOperator"];

			if (operator == null || operator == "") {
				throw new Error("比较操作符不能为空，请检查配置！");
			}
			if (srcCompareField == null || srcCompareField == "") {
				throw new Error("源实体比较字段不能为空，请检查配置！");
			}
			if (destCompareField == null || destCompareField == "") {
				throw new Error("目标实体比较字段不能为空，请检查配置！");
			}

			// 源实体比较字段类型必须与目标实体比较字段类型兼容
			var numberTypeArray = ["integer", "number"];
			var srcCompareFieldType = getFieldByDataSource(srcDataSource, srcCompareField).getType();

			if (!vds.string.isInArray(srcCompareFieldType, numberTypeArray)) {
				throw new Error("源实体比较字段必须为整数或数字类型，请检查配置！");
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
			try {
				validSaveMapping(isSave, mappings);
			} catch (e) {
				throw new Error("存储实体字段映射不能为空，请检查配置！");
			}

			if (isSave) {
				if (vds.string.isEmpty(saveDataSource)) {
					throw new Error("存储实体不能为空，请检查配置！");
				}
				if (saveDataSource == srcDataSource) {
					throw new Error("存储实体不能为源实体，请检查配置！");
				}
			}

			var srcRecords = getFilterRecords(srcDataSource, srcFilterCondition, ruleContext);
			if (srcRecords == null || srcRecords.length == 0) {
				setBusinessRuleResult(ruleContext, true);
				if (isSave && isClearSaveData) {
					var ds = vds.ds.lookup(saveDataSource);
					ds.clear();
				}
				resolve();
			}

			var destQueryCond = {};
			destQueryCond.srcDataSource = srcDataSource;
			destQueryCond.destDataSource = destDataSource;
			destQueryCond.destIsQuery = destIsQuery;

			var fetchMode = destIsQuery ? vds.ds.WhereType.Query : vds.ds.WhereType.Table;
			var wrParam = {
				"type": fetchMode,
				"methodContext": ruleContext.getMethodContext()
			};
			var w = vds.ds.createWhere(wrParam);

			// 组装设置的加载条件
			if (destFilterCondition && destFilterCondition.length > 0) {
				w.addCondition(destFilterCondition);
			}
			if (destQueryParams != null && destQueryParams.length > 0) {
				var tmpparams = genCustomParams(destQueryParams, ruleContext);
				w.addParameters(tmpparams);
			}
			var condition = w.toWhere();
			var valueParamMap = w.toParameters();
			destQueryCond.destWhere = condition;
			destQueryCond.destQueryParams = valueParamMap;

			destQueryCond.srcValues = srcRecords;
			destQueryCond.matchFields = matchFields;

			var cloneCompareCondition = cloneObj(compareCondition);
			var srcField = getFieldByDataSource(srcDataSource, srcCompareField);
			cloneCompareCondition.srcColumnTypeName = srcField.getType();
			destQueryCond.compareCondition = cloneCompareCondition;

			var callback = function (responseObj) {
				var success = responseObj.IsSuccess;
				if (!success) {
					vds.log.error("错误信息：" + result.msg);
					throw new Error("数据比较执行异常！");
				} else {
					var finalResultsValue = responseObj.CompareResults;
					var finalResults = vds.object.stringify(finalResultsValue);
					if (isSave) {
						if (isClearSaveData) {
							var ds = vds.ds.lookup(saveDataSource);
							ds.clear();
						}

						// 获取构造的存储实体数据
						if (finalResults != null && finalResults.length > 0) {
							var newSaveRecords = getCopyRecordsByMapping(saveDataSource, finalResults, mappings);
							var datasource = vds.ds.lookup(saveDataSource);
							datasource.insertRecords(newSaveRecords);
						}
					}
					if (finalResults != null
						&& finalResults.length == srcRecords.length)
						bussinessReturnValue = true;
					else
						bussinessReturnValue = false;

					setBusinessRuleResult(ruleContext, bussinessReturnValue);
					resolve();
				}
			};

			var sConfig = {
				"command": "CommonRule_CompareEntityAndTableData",
				"datas": [{
					"code": "InParams",
					"type": "char",
					"value": vds.string.toJson(destQueryCond)
				}],
				"params": { "isAsyn": true, "ruleContext": ruleContext }
			}
			//  调用后台活动集
			var promise = vds.rpc.callCommand(sConfig.command, sConfig.datas, sConfig.params);
			promise.then(callback).catch(reject);
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

var validSaveMapping = function (isSave, mappings) {
	if (!isSave)
		return;
	if (mappings == null || mappings.length == 0) {
		throw new Error("比较结果存储映射不能为空");
	}
	for (var i = 0; i < mappings.length; i++) {
		if (mappings[i].saveField == null || mappings[i].saveField == "") {
			throw new Error("比较结果存储字段不能为空");
		}
		if (mappings[i].resultField == null || mappings[i].resultField == "") {
			throw new Error("比较结果源或目标表及查询字段不能为空");
		}
	}
};

var cloneObj = function (obj) {
	var clone = {};
	for (var prop in obj) {
		clone[prop] = obj[prop];
	}
	return clone;
};

var getFieldName = function (fieldName) {
	if (fieldName != null && fieldName.indexOf(".") > 0)
		return fieldName.split(".")[1];
	return fieldName;
};

var getCopyRecordsByMapping = function (dataSource, records, mappingFields) {
	var datasource = vds.ds.lookup(dataSource);
	var emptyRecord = datasource.createRecord();

	var copyRecords = [];
	for (var i = 0; i < records.length; i++) {
		var tempRecord = emptyRecord.clone();
		if (datasource.getMetadata().contains("id")) {
			tempRecord.set("id", vds.string.uuid());
		}
		var obj = tempRecord;

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

var getFieldByDataSource = function (dataSource, fieldName) {
	var datasource = vds.ds.lookup(dataSource);
	var metadata = datasource.getMetadata();
	var fields = metadata.getFields();

	var field = null;
	if (fields != null) {
		for (var i = 0; i < fields.length; i++) {
			var metaFieldName = fields[i].getCode();
			var b = fieldName.split(".");
			if (metaFieldName == fieldName) {
				field = fields[i];
			}
			if (b.length == 2 && metaFieldName == b[1]) {
				field = fields[i];
			}
		}
	}
	return field;
};


/**
 *	根据源实体名称及拷贝类型来获取要拷贝的行数据
 *  @param	dataSource	源实体名称
 *  @param	condition		    源实体条件
 */
var getFilterRecords = function (dataSource, condition, ruleContext) {
	var outputRecords = [];
	var datasource = vds.ds.lookup(dataSource);
	var records = datasource.getAllRecords().toArray();

	if (condition == null || condition == "") {
		var resultData = [];
		if (records && records.length > 0) {
			for (var i = 0; i < records.length; i++) {
				var record = records[i];
				resultData.push(record.toMap());
			}
		}
		return resultData;
	}

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

//#region genCustomParams 方法

var genCustomParams = function (paramDefines, ruleContext) {
	var rs = {};
	if (paramDefines && paramDefines.length > 0) {
		for (var i = 0; i < paramDefines.length; i++) {
			var define = paramDefines[i];
			var key = define["queryfield"];
			if (!key) {
				key = define["Queryfield"];
			}
			var valueDefine = define["queryfieldValue"];
			if (!valueDefine) {
				valueDefine = define["QueryfieldValue"];
			}
			var type = define["type"];
			var componentControlID = define["componentControlID"]
			var value = getCustomParamValue(valueDefine, type, componentControlID, ruleContext);
			rs[key] = value;
		}
	}
	return rs;
}
/**
 * 获取自定义参数的值
 * @param queryfieldValue 参数值
 * @param type 参数类源类型(参数值类型1表字段，2系统变量，3组件变量，4固定值，5自定义，6面板参数，8控件的值, 9表达式)
 * @param componentControlId 参数来源控件
 */
var getCustomParamValue = function (queryfieldValue, type, componentControlId, ruleContext) {
	var returnValue = "";

	switch (vds.string.trim(type + "")) {
		case "1":
			if (queryfieldValue.indexOf(".") == -1) {
				vds.log.warn(queryfieldValue + " 格式必须为表名.字段名");
				break;
			}
			var ds = queryfieldValue.split(".")[0];
			var fieldName = queryfieldValue.split(".")[1];
			var record = getCurrentRecord(ds);
			returnValue = record.get(fieldName);
			break;
		case "2":
			returnValue = vds.component.getVariant(queryfieldValue);
			break;
		case "3":
			returnValue = vds.window.getInput(queryfieldValue);
			break;
		case "4":
			// returnValue = queryfieldValue;
			// 固定值(0:假，1:真，2:空)
			switch ((queryfieldValue + "").toLowerCase()) {
				case "0":
					returnValue = false;
					break;
				case "1":
					returnValue = true;
					break;
				case "2":
					returnValue = null;
					break;
				default:
					returnValue = queryfieldValue;
					break;
			}
			break;
		case "5":
			returnValue = queryfieldValue;
			break;
		case "6":
			var valueQueryControlID = componentControlId;
			var value = queryfieldValue;
			var storeType = vds.widget.getStoreType(valueQueryControlID);
			var storeTypes = vds.widget.StoreType;
			// 按照控件不同的属性类型，获取参数值
			var ds = getDsName(valueQueryControlID);
			var record = getCurrentRecord(ds);
			if (storeTypes.Set == storeType) {
				// 集合类控件，组装表名.字段名进行取值
				if (record) {
					var field = value.split("_")[1];
					returnValue = record.get(field);
				} else {
					vds.log.error("集合控件:" + valueQueryControlID + " 无选中行，无法获取其参数值");
				}
			} else if (storeTypes.SingleRecordMultiValue == storeType) {
				// 单记录多值控件，按照控件属性名字取得关联的标识，再进行取值
				//var propertyCode = value.split("_")[1];
				var propertyCode = "";
				// 目前认为使用-分隔，也可以使用_分隔
				if (value.indexOf("-") != -1) {
					propertyCode = value.split("-")[1];
				} else {
					propertyCode = value.split("_")[1];
				}
				var fieldCode = vds.widget.getProperty(valueQueryControlID, propertyCode);
				returnValue = record.get(fieldCode);
			} else if (storeTypes.SingleRecord == storeType) {
				// 单值控件，直接取值
				var fieldCode = vds.widget.getFieldCodes(ds, valueQueryControlID)[0];
				returnValue = record.get(fieldCode);
				if (null == returnValue || undefined == returnValue) {
					returnValue = "";
				}
			}
			break;
		case "8":
		case "9":
		default:
			if (!queryfieldValue) {// modify by xiedh 2016-04-26,预先校验，防止执行表达式报错
				if (null == queryfieldValue || undefined == queryfieldValue) {
					returnValue = null;
				} else {
					returnValue = queryfieldValue;
				}//end modify
			} else {
				returnValue = vds.expression.execute(queryfieldValue, {
					"ruleContext": ruleContext
				});
			}
			break;
	}
	//todo
	if (queryfieldValue !== "\"\"" && returnValue === "") {
		return null;
	}
	// 统一输出为字符串
	//return (null == returnValue || undefined == returnValue ? "" : returnValue);
	return (undefined == returnValue ? null : returnValue);
}
var getCurrentRecord = function (ds) {
	var datasource = vds.ds.lookup(ds);
	return datasource.getCurrentRecord();
}

var getDsName = function (widgetCode) {
	var dsNames = vds.widget.getDatasourceCodes(widgetCode);
	return dsNames[0];
}

//#endregion

export { main }