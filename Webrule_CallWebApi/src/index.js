/**
 * 调用WebAPI
 */

vds.import("vds.component.*", "vds.ds.*", "vds.exception.*", "vds.expression.*", "vds.object.*", "vds.rpc.*", "vds.widget.*", "vds.window.*");

// 规则主入口(必须有)
var main = function (ruleContext) {
	return new Promise(function (resolve, reject) {
		try {
			// 获取开发系统配置的参数
			var params = ruleContext.getVplatformInput();
			var webAPISite = params["webAPISite"];
			webAPISite = vds.expression.execute(webAPISite, { "ruleContext": ruleContext });
			var timeOut = Number(params["timeOut"]) * 1000;
			var serviceProvider = params["serviceProvider"];
			var tenantCode = params["tenantCode"];
			var inputParams = params["inputParams"];
			var returnMapping = params["returnMapping"];
			//第三方返回值参数
			var invokeTargetType = params["invokeTargetType"];
			var invokeTarget = params["invokeTarget"];
			var respondTargetType = params["respondTargetType"];
			var respondTarget = params["respondTarget"];

			var returnInputParams = getInputParams(inputParams, ruleContext);
			if (tenantCode != "") {//租户信息放到参数内
				tenantCode = vds.expression.execute(tenantCode, { "ruleContext": ruleContext });
				if (tenantCode != "") {
					returnInputParams["tenantCode"] = tenantCode;
				}
			}
			//api请求
			requestApi(webAPISite, returnInputParams, timeOut, serviceProvider, returnMapping, invokeTargetType, invokeTarget, respondTargetType, respondTarget, ruleContext, resolve, reject);
		} catch (ex) {
			reject(ex);
		}
	});
};

var requestApi = function (webAPISite, returnInputParams, timeOut, serviceProvider, returnMapping, invokeTargetType, invokeTarget, respondTargetType, respondTarget, ruleContext, resolve, reject) {
	if (webAPISite == "") {
		throw new Error("CallWebApi规则:[WebAPI地址]不能为空！");
	}
	var host, componentCode, apiCode;
	if (serviceProvider == "WebAPI") {//平台api
		//webAPISite 拆分参数
		var startHost = 0;
		var endHost = webAPISite.indexOf("/webapi/");
		var startComp = endHost + 8;
		var endComp = webAPISite.lastIndexOf("/");
		var startApiCode = endComp + 1;
		var endApiCode = webAPISite.indexOf("?");
		if (endApiCode == -1) {
			endApiCode = webAPISite.length;
		}
		host = webAPISite.substring(startHost, endHost);
		componentCode = webAPISite.substring(startComp, endComp);
		apiCode = webAPISite.substring(startApiCode, endApiCode);
		if (host != "" && componentCode != "" && apiCode != "") {
			invokeV3Webapi(webAPISite, returnInputParams, timeOut, returnMapping, ruleContext, resolve, reject);
		} else {
			throw new Error("地址格式错误，api地址：" + webAPISite);
		}
	} else {//第三方api
		invokeOtherApi(webAPISite, returnInputParams, timeOut, invokeTargetType, invokeTarget, respondTargetType, respondTarget, ruleContext, resolve, reject);
	}
}

var invokeOtherApi = function (webAPISite, returnInputParams, timeOut, invokeTargetType, invokeTarget, respondTargetType, respondTarget, ruleContext, resolve, reject) {
	var setReturn = function (invokeSourceValue, respondSourceValue) {
		setVarValue(invokeTarget, invokeTargetType, invokeSourceValue, ruleContext);
		setVarValue(respondTarget, respondTargetType, respondSourceValue, ruleContext);
		resolve();
	}
	var invokeSourceValue, respondSourceValue;
	$.ajax({
		url: webAPISite,
		data: returnInputParams,
		timeout: timeOut,
		type: "Get",
		dataType: "jsonp",
		success: function (param) {
			invokeSourceValue = true;
			setReturn(invokeSourceValue, param);
		},
		error: function (re) {
			invokeSourceValue = false;
			if (re.statusText == "timeout") {
				var exception = new Error("第三方Api访问超时");
				reject(exception);
				respondSourceValue = "CallWebApi规则:第三方Api访问超时";
			} else {
				respondSourceValue = "CallWebApi规则:" + re.statusText;
			}
			setReturn(invokeSourceValue, respondSourceValue);
		}
	});
}

var invokeV3Webapi = function (webAPISite, returnInputParams, timeOut, returnMapping, ruleContext, resolve, reject) {
	var success = ruleContext.genAsynCallback(
		function (param) {
			handleReturnValues(ruleContext, param, returnMapping);
			resolve();
		}
	);

	var error = ruleContext.genAsynCallback(
		function (param) {
			var exception = vds.exception.newSystemException(param.msg);
			reject(exception);
		}
	);

	var params = { "param": returnInputParams, "timeout": timeOut };
	var promise = vds.rpc.callWebapi(webAPISite, params);
	promise.then(success).catch(error);
}

var getInputParams = function (inputParams, ruleContext) {//入参处理
	var returnInputParams = {};
	if (inputParams == null) return returnInputParams;
	for (var i = 0; i < inputParams.length; i++) {
		var inP = inputParams[i];
		var inPName = inP["paramName"];
		var inPType = inP["paramType"];
		var inSType = inP["srcType"];
		var inS = inP["src"];
		if (inPType != "entity") {
			if (inSType == "expression") {//目前只有表达式一种类型
				var srcValue = vds.expression.execute(inS, { "ruleContext": ruleContext });
				returnInputParams[inPName] = srcValue;
			}
		} else {//入参为实体
			var entityDatas = [];
			returnInputParams[inPName] = entityDatas;
			var entity = getEntity(inS, inSType, ruleContext);
			var dataFilterType = inP["dataFilterType"];
			var paramFieldMapping = inP["paramFieldMapping"];
			var mapping = getMapping(paramFieldMapping);
			var resultSet;
			if (dataFilterType == "all") {
				resultSet = entity.getAllRecords();
			} else {
				resultSet = entity.getUpdatedRecords();
			}
			var records = resultSet.toArray();
			for (var j = 0; j < records.length; j++) {
				var datas = {};
				var record = records[j];
				var data = record.toMap();
				for (var key in mapping) {
					var map = mapping[key];
					var fieldType = map["fieldType"];
					var value = map[key];
					if (fieldType == "expression") {
						var exp = vds.expression.execute(value, { "ruleContext": ruleContext });
						datas[key] = exp;
					} else {
						datas[key] = data[value];
					}
				}
				entityDatas.push(datas);
			}
			returnInputParams[inPName] = JSON.stringify(entityDatas);
		}
	}
	return returnInputParams;
}

var getMapping = function (paramFieldMapping) {
	var mapping = {};
	for (var j = 0; j < paramFieldMapping.length; j++) {
		var field = paramFieldMapping[j];
		var fieldName = field["paramEntityField"];
		var fieldType = field["fieldValueType"];
		var fieldValue = field["fieldValue"];
		var field = {}
		field["fieldType"] = fieldType;
		if (fieldType != "expression") {
			field[fieldName] = getFieldColumn(fieldValue);
		} else {
			field[fieldName] = fieldValue;
		}
		mapping[fieldName] = field;

	}
	return mapping;
}

var getFieldColumn = function (field) {
	if (field.indexOf(".") > 0) {
		return field.split(".")[1];
	} else {
		return field;
	}
}

var handleReturnValues = function (ruleContext, ReturnValue, returnMappings) {
	//返回值处理
	if (!returnMappings || returnMappings.length <= 0) {
		return;
	}
	if (ReturnValue == null) {
		return;
	}

	/**
	 * 内部方法，获取赋值来源值
	 */
	var getSourceValue = function (source, sourceType) {
		var sourceValue = null;
		switch (sourceType) {
			case "returnValue":
				sourceValue = ReturnValue[source];
				break;
			case "expression":
				sourceValue = vds.expression.execute(source, { "ruleContext": ruleContext });
				break;
			default:
				break;
		}
		return sourceValue;
	};

	var insertOrUpdateRecords2Entity = function (entityName, entityType, records, mappings, operType, isClearDatas, ruleContext) {

		if (undefined == ruleContext || null == ruleContext)
			throw new Error("规则上下文获取失败，请传入正确的ruleContext");

		// 如果目标不是一个实体对象
		if (!vds.ds.isDatasource(entityName, entityType, ruleContext))
			throw new Error("[" + entityName + "]不是实体对象");

		if (operType == 'updateRecord' && isClearDatas == true)
			throw new Error("更新类型为：更新记录时，不能勾选清空数据，请检查配置");

		if (operType == 'loadRecord' && isClearDatas == false)
			throw new Error("更新类型为：加载数据时，一定要勾选清空数据，请检查配置");

		var destEntity = getEntity(entityName, entityType, ruleContext);
		// 清空目标实体中的数据
		if (isClearDatas) {
			destEntity.clear();
		}
		// 如果来源记录为空，则不做任何动作
		if (!records || (vds.object.isArray(records) && records.length < 1) || !mappings || (vds.object.isArray(mappings) && mappings.length < 1)) {
			return;
		}

		var updateRecords = [];
		var insertRecords = [];

		for (var i = 0; i < records.length; i++) {
			var record = records[i];
			var oldRecord = null;
			var newRecord = null;

			var hasId = false;
			var tmpObj = {};
			for (var index = 0; index < mappings.length; index++) {
				// 来源值类型,returnValue:返回值，expression:表达式
				var srcValueType = mappings[index]["srcValueType"];
				var srcValue = mappings[index]["srcValue"];
				// 前台目标实体字段
				var destField = mappings[index]["destField"];
				// srcField = jsTool.getFieldName(srcField);
				var value = _getValueByMapping(record, srcValueType, srcValue, ruleContext);
				if (destField.indexOf(".") != -1) {
					var destFieldArray = destField.split(".");
					destField = destFieldArray[destFieldArray.length - 1];
				}

				tmpObj[destField] = value;
				if (destField.toLocaleLowerCase() == "id") {
					hasId = true;
					if (value != null && value != "") {
						oldRecord = destEntity.getRecordById(value)
					}
				}
			}

			// 为更新当前记录时只取第一个返回值
			if (operType == 'updateRecord') {
				// 操作类型为更新时，如果目标实体没有当前行，则取其第一行
				oldRecords = [];
				oldRecords = destEntity.getSelectedRecords().toArray();
				if (oldRecords.length < 1)
					if (destEntity.getAllRecords().toArray().length > 0)
						oldRecords.push(destEntity.getRecordByIndex(0));
				// 如果操作类型为更新，并且获取不到目标实体的当前选中记录或第一条记录，则跳出
				if (oldRecords.length < 1)
					break;
				// 把新记录的值赋值到旧记录中，id不会赋值过去
				for (var j = 0; j < oldRecords.length; j++) {
					if (undefined == oldRecords[j] || null == oldRecords[j])
						continue;
					for (proName in tmpObj) {
						if (proName.toLocaleLowerCase() != "id")
							oldRecords[j].set(proName, tmpObj[proName]);
					}
					updateRecords.push(oldRecords[j]);
				}
			} else {
				var isOldRecordDeleted = false;
				if (undefined != oldRecord && null != oldRecord) {
					isOldRecordDeleted = destEntity.isDeletedRecord({
						"record": oldRecord
					});
				}
				if (oldRecord != null && isOldRecordDeleted) {
					// 如果id匹配的记录为删除状态，则报错。
					throw new Error("返回实体不能更新已经删除的记录!");
				}
				// 如果获取不到目标实体的记录，则新增
				if (oldRecord == null)
					newRecord = destEntity.createRecord();
				for (proName in tmpObj) {
					if (oldRecord == null)
						newRecord.set(proName, tmpObj[proName]);
					else if (proName.toLocaleLowerCase() != "id")
						oldRecord.set(proName, tmpObj[proName]);
				}
				if (oldRecord == null)
					insertRecords.push(newRecord);
				else
					updateRecords.push(oldRecord);
			}

			// 如果操作类型为更新，则只更新一条记录，所以在处理完第一条记录后跳出循环
			if (operType == 'updateRecord')
				break;
		}

		if (updateRecords != null && updateRecords.length > 0) {
			destEntity.updateRecords(updateRecords);
		}

		if (insertRecords != null && insertRecords.length > 0) {
			if (operType == 'loadRecord') {
				var datas = [];
				for (var i = 0; i < insertRecords.length; i++) {
					datas.push(insertRecords[i].toMap());
				}
				destEntity.load({
					"datas": datas,
					"isAppend": false
				});
			} else {
				destEntity.insertRecords(insertRecords);
			}
		}
	};

	var _getValueByMapping = function (record, srcColumnType, srcColumn, ruleContext) {
		// 来源字段类型,returnValue:返回值，expression:表达式
		var value = null;
		// srcColumnType为空时应该是旧数据，兼容处理下
		if (srcColumnType == "expression") {
			value = vds.expression.execute(srcColumn, { "ruleContext": ruleContext });
		} else {
			value = record[srcColumn];
		}
		if (value == undefined) {
			value = null;
		}
		return value;
	};
	for (var i = 0; i < returnMappings.length; i++) {
		var mappings = returnMappings[i];
		var destName = mappings["dest"];
		var destType = mappings["destType"];

		var sourceName = mappings["return"];
		var sourceType = mappings["returnType"];
		var sourceValue = getSourceValue(sourceName, sourceType);

		var operType = mappings["updateDestEntityMethod"];
		var isCleanTarget = mappings["isCleanDestEntityData"];


		if (vds.ds.isDatasource(destName, destType, ruleContext)) {
			// 如果实体不存在 则不执行更新数据
			insertOrUpdateRecords2Entity(destName, destType, sourceValue, mappings["destFieldMapping"], operType, isCleanTarget, ruleContext);
		} else {
			setVarValue(destName, destType, sourceValue, ruleContext);
		}
	}
};

var setVarValue = function (destName, destType, sourceValue, ruleContext) {
	switch (destType) {
		case "control":
			var dsName = vds.widget.getDatasourceCodes(destName)[0];
			var fieldName = vds.widget.getFieldCodes(dsName, destName)[0];
			var dataSource = vds.ds.lookup(dsName);
			var record = dataSource.getCurrentRecord();
			if (!record) {
				record = dataSource.createRecord();
				dataSource.insertRecords([record]);
			}
			record.set(fieldName, sourceValue);
			dataSource.updateRecords([record]);
			break;
		case "windowVariant":
			vds.window.setInput(destName, sourceValue);
			break;
		case "systemVariant":
			vds.component.setVariant(destName, sourceValue);
			break;
		case "ruleSetVariant":
			ruleContext.getMethodContext().setVariable(destName, sourceValue);
			break;
		case "ruleSetOutput":
			ruleContext.getMethodContext().setOutput(destName, sourceValue);
			break;
		case "windowOutput":
			vds.window.setOutput(destName, sourceValue);
			break;
		default:
			break;
	}
}
var getEntity = function (entityName, entityType, ruleContext) {
	if (undefined == ruleContext || null == ruleContext)
		throw new Error("规则上下文获取失败，请传入正确的ruleContext");

	var entity;
	if (entityType == "entity" || entityType == "window") {
		entity = getDatasource(entityName);
	} else if (entityType == "windowVariant" || entityType == "windowInput") {
		entity = vds.window.getInput(entityName);
	} else if (entityType == "windowOutput") {
		entity = vds.window.getOutput(entityName);
	} else if (entityType == "ruleSetInput") {
		entity = ruleContext.getMethodContext().getInput(entityName);
	} else if (entityType == "ruleSetOutput") {
		entity = ruleContext.getMethodContext().getOutput(entityName);
	} else if (entityType == "ruleSetVariant" || entityType == "ruleSetVar") {
		entity = ruleContext.getMethodContext().getVariable(entityName);
	}
	if (undefined == entity || null == entity)
		throw new Error("找不到类型为[" + entityType + "]的实体：" + entityName);
	return entity;
};

var getDatasource = function (datasourceName) {
	if (undefined == datasourceName || null == datasourceName)
		return null;
	var datasource = vds.ds.lookup(datasourceName);
	return datasource;
};

export { main }