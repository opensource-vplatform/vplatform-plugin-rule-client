/**
 * 流程提交
 */
vds.import("vds.exception.*", "vds.expression.*", "vds.string.*", "vds.object.*", "vds.rpc.*", "vds.ds.*");
/**
 * 规则入口
 */
var main = function (ruleContext) {
	return new Promise(function (resolve, reject) {
		try {
			var inParams = ruleContext.getVplatformInput();
			if (!inParams) { //建议兼容
				inParams = "";
			}
			var restoreDataSrc = inParams["RestoreDataSrc"];
			var restoreDataType = inParams["RestoreDataType"];
			var restoreDataDetail = inParams["RestoreDataDetail"];

			if (restoreDataType != "JSON" && restoreDataType != "XML") {
				throw vds.exception.newConfigException("[RestoreXMLOrJSON]规则json配置有误,还原数据来源未设置，无法进行配置数据还原");
			}

			if (typeof restoreDataSrc != "string" || restoreDataSrc == "") {
				throw vds.exception.newConfigException("[RestoreXMLOrJSON]规则json配置有误,数据来源表达式值不为JSON和XML，无法进行配置数据还原");
			}

			if (!vds.object.isArray(restoreDataDetail) || restoreDataDetail.length <= 0) {
				throw vds.exception.newConfigException("[RestoreXMLOrJSON]规则json配置有误,还原数据内容未指定，无法进行配置数据还原");
			}

			//配置数据内容值
			var restoreDataValue = vds.expression.execute(restoreDataSrc, {
				"ruleContext": ruleContext
			});
			if (typeof restoreDataValue != "string" || restoreDataValue == "") {
				throw vds.exception.newConfigException("执行规则配置的数据来源表达式:" + restoreDataValue + ",返回值不允许为空且必须为字符串");
			}

			//元素名到字段名的映射Map
			var elementNameToFieldNameMap = {};
			var elementNames = [];

			for (var index = 0; index < restoreDataDetail.length; index++) {
				var restoreDataElement = restoreDataDetail[index];
				var elementNameSrc = restoreDataElement["ElementNameSrc"];
				var elementValueDestField = restoreDataElement["ElementValueDestField"];

				if (typeof elementNameSrc != "string" || elementNameSrc == "") {
					throw vds.exception.newConfigException("[RestoreXMLOrJSON]规则json配置有误,还原数据内容中，元素名来源表达式串不允许为空且必须为字符串。");
				}
				if (typeof elementValueDestField != "string" ||
					elementValueDestField == "" ||
					elementValueDestField.indexOf(".") == -1) {
					throw vds.exception.newConfigException("[RestoreXMLOrJSON]规则json配置有误,还原数据内容中，元素值对应的实体字段未设置，或字段名格式有误。");
				}

				//			var elementNameValue = formulaUtil.evalExpression(elementNameSrc);
				var elementNameValue = vds.expression.execute(elementNameSrc, {
					"ruleContext": ruleContext
				});
				if (typeof elementNameValue != "string" || elementNameValue == "") {
					throw vds.exception.newConfigException("执行规则配置的元素名来源表达式:" + elementNameValue + ",返回值不允许为空且必须为字符串");
				}

				elementNameToFieldNameMap[elementNameValue] = elementValueDestField;
				elementNames.push(elementNameValue);
			}

			var reqData = _generateRequestData(restoreDataType, restoreDataValue, elementNames);

			// 调用完活动集之后的回调方法
			var callback = function (responseObj) {
				//var outputResult = responseObj.data.result;
				var outputResult = responseObj.OutputMessage;
				var jsonData = vds.object.stringify(outputResult);
				var elementNameToValueMap = {};

				for (var index = 0; index < elementNames.length; index++) {
					var elementName = elementNames[index];
					var elementValue = jsonData[elementName];
					var elementValueArr = [];
					if (vds.object.isArray(elementValue)) {
						for (var subIndex = 0; subIndex < elementValue.length; subIndex++) {
							var elementCellValue = elementValue[subIndex];
							elementValueArr.push(elementCellValue);
						}
					} else {
						elementValueArr.push(elementValue);
					}
					elementNameToValueMap[elementName] = elementValueArr;
				}

				var tableToFieldArr = {};
				for (var elementName in elementNameToFieldNameMap) {
					var fieldName = elementNameToFieldNameMap[elementName];
					if (!elementNameToValueMap[elementName]) {
						continue;
					}
					var table = fieldName.substring(0, fieldName.indexOf("."));
					var field = fieldName.substring(fieldName.indexOf(".") + 1);
					if (!vds.object.isArray(tableToFieldArr[table])) {
						tableToFieldArr[table] = [];
					}
					tableToFieldArr[table].push({
						"field": field,
						"element": elementName
					});
				}

				for (var table in tableToFieldArr) {
					var fieldObjArr = tableToFieldArr[table];
					fieldObjArr.sort(function (a, b) {
						var aField = a.field;
						var aElement = a.element;

						var bField = b.field;
						var bElement = b.element;

						var aElementValueArr = elementNameToValueMap[aElement];
						var bElementValueArr = elementNameToValueMap[bElement];
						if (
							vds.object.isArray(aElementValueArr) &&
							vds.object.isArray(bElementValueArr)) {

							if (aElementValueArr.length > bElementValueArr.length) {
								return 1;
							} else if (aElementValueArr.length < bElementValueArr.length) {
								return -1;
							} else {
								return 0;
							}
						} else if (!vds.object.isArray(aElementValueArr)) {
							return -1;
						} else if (!vds.object.isArray(bElementValueArr)) {
							return 1;
						}
					});
					var largestSizeFieldObj = fieldObjArr[fieldObjArr.length - 1];
					var largestSizeElement = largestSizeFieldObj.element;
					var largestSizeElementValueArr = elementNameToValueMap[largestSizeElement];
					var largestSize = largestSizeElementValueArr.length;

					var emptyRecords = [];
					var datasource = vds.ds.lookup(table);
					var metadata = datasource.getMetadata();
					var emptyRecord = datasource.createRecord();
					for (var index = 0; index < largestSize; index++) {
						var tempRecord = emptyRecord.clone();
						if (metadata.contains("id")) {
							tempRecord.set("id", vds.string.uuid());
						}
						var record = tempRecord;

						emptyRecords.push(record);
					}

					for (var index = 0; index < fieldObjArr.length; index++) {
						var fieldObj = fieldObjArr[index];
						var field = fieldObj.field;
						var element = fieldObj.element;
						var elementValueArr = elementNameToValueMap[element];

						for (var subIndex = 0; subIndex < largestSize; subIndex++) {
							if (subIndex >= elementValueArr.length) {
								break;
							}

							var elementValue = elementValueArr[subIndex];
							emptyRecords[subIndex].set(field, elementValue);
						}
					}

					var elementValue = elementValueArr[subIndex];
					var datasource = vds.ds.lookup(table);
					datasource.insertRecords(emptyRecords);
				}
				resolve();
			};
			var promise = vds.rpc.callCommand("CommonRule_RestoreXMLOrJSON", [{
				"code": "InParams",
				"type": "char",
				"value": vds.string.toJson({//后台规则参数
					"datas": reqData
				})
			}], {
				"isAsyn": true,
				"ruleContext": ruleContext
			});
			promise.then(callback).catch(reject);
		} catch (err) {
			reject(err);
		}
	});
}

/**
 * 生成请求后台规则数据体
 * @param {Object} restoreDataType
 * @param {Object} restoreDataValue
 * @param {Object} elementNames
 */
var _generateRequestData = function (restoreDataType, restoreDataValue, elementNames) {
	var reqData = {};
	reqData.restoreDataType = restoreDataType;
	reqData.restoreDataValue = restoreDataValue;
	reqData.elementNames = elementNames;
	return reqData;
};

export {
	main
}