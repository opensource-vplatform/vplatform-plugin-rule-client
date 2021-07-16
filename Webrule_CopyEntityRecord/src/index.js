/**
 * 实体间复制记录
 * 
 * @createDate 2013-03-09重构
 */

var ruleContext;
var datasourceUtil;
var puller;
var entityVarOperation;

exports.initModule = function (sBox) {
	datasourceUtil = sBox.getService("vjs.framework.extension.platform.services.view.logic.datasource.DatasourceUtil");
	puller = sBox.getService("vjs.framework.extension.platform.services.domain.datasource.DatasourcePuller");
	entityVarOperation = sBox.getService("vjs.framework.extension.platform.services.window.variable.operation.EntityVarOperation");
}
// 复制类型
var COPY_TYPE = {
	SELECTEDROWS: "1", // 选中行
	ALLRECORDS: "2", // 所有行
	SELECTEDROWS_CURRENTROW: "3", //当前行和选中行
	CURRENTROW: "4"  //当前行
};

// 字段映射关系中的源数据来源类型
var SOURCE_TYPE = {
	ENTITY: "1", // 实体字段
	SYSTEMVAR: "2", // 系统变量
	COMPONENTVAR: "3", // 组件变量
	EXPRESSION: "4" // 表达式
};

// 源和目标记录重复时的操作类型
var OPERATOR_TYPE = {
	APPEND: "1",// 追加
	IGNORE: "2",// 忽略
	REPLACE: "3",// 替换
	MERGE: "4"// 合并
};

vds.import("vds.object.*", "vds.exception.*", "vds.expression.*", "vds.message.*", "vds.ds.*");

var main = function (ruleCtxt) {
	return new Promise(function (resolve, reject) {
		try {
			ruleContext = ruleCtxt;
			var inParams = ruleContext.getVplatformInput();

			// 复制数据来源实体
			var sourceName = inParams.sourceName;
			// 复制类型：选中行/所有行
			var copyType = inParams.copyType;
			// 源实体过滤条件
			var condition = inParams.condition;

			// 字段赋值对应关系
			var fieldMapping = inParams.items;
			if (!fieldMapping || fieldMapping.length == 0) {
				throw new Error("配置有误！实体间复制记录，必须配置字段映射关系！");
			}

			// 要复制到的目标实体
			var destName = inParams.destName;
			// 源和目标记录重复时的操作类型
			var operatorType = inParams.type;
			// 源和目标重复判定字段
			var checkItems = inParams.checkitems;
			// 源和目标合并时，需要合并的字段，必须是数值类型
			var mergeItems = inParams.mageitems;

			// 检测：id如果在字段映射关系中有设置，那么id就必须唯一用于重复判断字段，
			// 否则，多次操作必然导致id重复
			for (var i = 0; i < fieldMapping.length; i++) {
				var destField = fieldMapping[i].destName;
				if (puller.getFieldName(destField).toLowerCase() == 'id') {
					if (checkItems == null || checkItems.length != 1 || checkItems[0] != destField) {
						// throw new
						// Error("配置错误！字段映射关系中目标字段如果设置id，那么id就必须唯一用于重复判断字段，否则，多次操作很容易导致id重复");
						// FIXME 考虑已发布的规则数据升级的原因，异常改为警告，在发布阶段检查
						vds.log.warn("警告：实体间复制记录规则配置有误！字段映射关系中目标字段如果设置id，那么id就必须唯一用于重复判断字段，否则，多次操作很容易导致id重复");
						break;
					}
				}
			}

			// 1.0版本json结构处理逻辑
			var jsonVersion = inParams.jsonVersion;
			if (!vds.string.isEmpty(jsonVersion) && jsonVersion == "1.0") {
				inParams.mergeItems = inParams.mageitems;
				delete inParams.mageitems;

				inParams.checkItems = inParams.checkitems;
				delete inParams.checkitems;

				inParams.operationType = inParams.type;
				delete inParams.type;

				entityVarOperation.copyEntity(inParams, ruleContext.getRouteContext());
				return;
			}

			// 选择符合条件的来源记录
			var sourceRecords = _getSourceEntityRecords(sourceName, copyType, condition);
			if (sourceRecords == null || sourceRecords.length == 0) {
				return;
			}
			// 根据字段映射关系转换后的来源记录
			var mappingRecords = _mappingRecords(sourceRecords, fieldMapping);

			var changedRecords = null;
			// 如果操作类型为追加，则不需要进行重复判定，简单insert即可。
			if (operatorType == OPERATOR_TYPE.APPEND) {
				changedRecords = _appendToDest(destName, mappingRecords, fieldMapping);
			}
			// 否则其他的操作类型，都需要检查重复判定，根据重复结果进行不同操作
			else {
				changedRecords = _copyToDest(destName, mappingRecords, fieldMapping, operatorType, checkItems, mergeItems);
			}

			// 如果复制到目标实体记录不为空，默认选中第一条
			if (changedRecords != null && changedRecords.length > 0) {
				var datasource = vds.ds.lookup(destName);
				datasource.setCurrentRecord({ "record": changedRecords[0] });
			}
		} catch (ex) {
			reject(ex);
		}
	});
};

/**
 * 从来源实体选择符合条件的记录数据
 * 
 * @param sourceName
 *            源实体名
 * @param copyType
 *            源实体数据选择方式：选中行/所有行
 * @param condition
 *            源实体的数据过滤条件
 */
var _getSourceEntityRecords = function (sourceName, copyType, condition) {
	if (!vds.ds.exists(sourceName)) {
		throw new Error("来源实体不存在！sourceName=" + sourceName);
	}

	// 源记录集合
	var records = [];
	var datasource = vds.ds.lookup(sourceName);
	if (copyType == COPY_TYPE.ALLRECORDS) {
		records = datasource.getAllRecords().toArray();
	} else if (copyType = COPY_TYPE.SELECTEDROWS) {
		records = datasource.getSelectedRecords().toArray()
	} else if (copyType == COPY_TYPE.SELECTEDROWS_CURRENTROW) {
		records = datasource.getSelectedRecords().toArray();//勾选的数据
		var currentSelected = datasource.getCurrentRecord();//当前选中数据（高亮）
		if (currentSelected) {
			if (null == records)
				records = [];

			var exist = false;
			//去重（勾选和高亮可能重复）
			for (var i = 0; i < records.length; i++) {
				var record = records[i];
				if (record.getSysId() == currentSelected.getSysId()) {
					exist = true;
					break;
				}
			}
			if (!exist)
				records.push(currentSelected);
		}
	} else if (copyType == COPY_TYPE.CURRENTROW) {
		var currentSelected = datasource.getCurrentRecord();//当前选中数据（高亮）
		if (currentSelected)
			records.push(currentSelected);
	}

	if (records == null || records.length == 0) {
		vds.log.warn("要复制的源实体没有符合条件的记录！sourceName=" + sourceName + ",copyType=" + copyType);
		return records;
	}

	if (condition == null || vds.string.trim(condition) === '') {
		return records;
	}

	// 过滤后的记录集合
	var result = [];

	// 按条件对源记录集合进行过滤
	for (var i = 0; i < records.length; i++) {
		var record = records[i];
		try {
			var ret = vds.expression.execute(condition, { "ruleContext": ruleContext, "records": [record] });
			if (typeof ret != "boolean") {
				throw new Error("条件必须返回布尔类型");
			}
			if (ret == true) {
				result.push(record);
			}
		} catch (e) {
			var message = "表达式执行错误！condition=" + condition + "错误信息：" + e.message;
			vds.log.error(message);
			throw new Error("实体过滤条件不正确！" + message);
		}
	}

	if (result.length == 0) {
		vds.log.log("过滤后的源实体没有符合条件的记录！condition=" + condition);
	}
	return result;
};

/**
 * 按照字段映射关系转换原始记录为目标字段的集合
 * 
 * @param sourceRecords
 *            原始记录的集合
 * @param fieldMapping
 *            字段映射关系
 */
var _mappingRecords = function (sourceRecords, fieldMapping) {
	try {
		var result = [];
		var cache = {
			"variable": {},
			"systemVariable": {}
		};
		for (var i = 0; i < sourceRecords.length; i++) {
			result.push(_mappingRecord(sourceRecords[i], fieldMapping, cache));
		}
		return result;
	} catch (e) {
		var message = "按照字段映射关系取值失败！错误信息：" + e.message + ",映射关系：" + vds.string.toJson(fieldMapping);
		vds.log.error(message);
		throw e;
	}
};

/**
 * 转换一条记录<br>
 * 按照字段映射关系转换原始记录为目标字段的集合
 * 
 * @param sourceRecord
 *            原始记录
 * @param fieldMapping
 *            字段映射关系
 */
var _mappingRecord = function (sourceRecord, fieldMapping, cache) {
	var result = {};
	var variable = cache.variable;
	var systemVariable = cache.systemVariable;
	for (var i = 0; i < fieldMapping.length; i++) {
		var destField = fieldMapping[i].destName;
		var sourceField = fieldMapping[i].sourceName;
		var sourceType = fieldMapping[i].type;
		var value = null;
		switch ("" + sourceType) {
			case "entityField":
				// 来源
				value = sourceRecord.get(sourceField);
				break;
			case "expression":
				// 来源表达式
				value = vds.expression.execute(sourceField, { "ruleContext": ruleContext, "records": [record] });
				break;
			default:
				throw new Error("配置错误！字段映射关系中类型无效：fieldMapping.type=" + sourceType);
		}

		result[destField] = value;
	}

	return result;
};

/**
 * 用于重复记录操作方式为：追加
 */
var _appendToDest = function (destName, mappingRecords, fieldMapping) {
	if (!vds.ds.exists(destName)) {
		throw new Error("目标实体不存在！destName=" + destName);
	}

	var insertRecords = [];
	if (mappingRecords.length > 0) {
		//			var emptyRecord = viewModel.getDataModule().createEmptyRecordByDS(destName, true);
		var datasource = vds.ds.lookup(destName);
		var emptyRecord = datasource.createRecord();

		for (var i = 0, mappingRecord; mappingRecord = mappingRecords[i]; i++) {
			// 使用克隆，防止调用createEmptyRecordByDS接口重新设置默认中，消耗性能
			//var record = emptyRecord.createNew();

			var tempRecord = emptyRecord.clone();
			if (tempRecord.getMetadata().isContainField("id")) {
				tempRecord.set("id", vds.string.uuid());
			}
			var record = tempRecord;

			record = _setRecordValue(record, mappingRecords[i], fieldMapping);
			insertRecords.push(record);
		}
	}

	if (insertRecords.length > 0) {
		var datasource = vds.ds.lookup(destName);
		var rs = datasource.insertRecords(insertRecords);
	}

	return insertRecords;
}

/**
 * 将源记录按照操作要求复制到目标实体
 * 
 * @param destName
 *            目标实体
 * @param mappingRecords
 *            已转换后的原始数据
 * @param operatorType
 *            重复记录时执行何种操作
 * @param fieldMapping
 *            映射字段（有哪些字段是需要复制或比较的）
 * @param checkItems
 *            用什么来判定重复
 * @param mergeItems
 *            需要合并值的字段
 */
var _copyToDest = function (destName, mappingRecords, fieldMapping, operatorType, checkItems, mergeItems) {
	if (!vds.ds.exists(destName)) {
		throw new Error("目标实体不存在！destName=" + destName);
	}

	// 为避免多次触发事件，在操作完成后一次性将变动的记录插入、或者修改到目标实体
	var insertRecords = [];
	var updateRecords = [];
	// 目标实体的已有记录（用来做重复比较）
	//		var destRecords = viewModel.getDataModule().getAllRecordsByDS(destName);
	var datasource = vds.ds.lookup(destName);
	var destRecords = datasource.getAllRecords().toArray();

	var emptyRecord;
	for (var i = 0; i < mappingRecords.length; i++) {
		var mappingRecord = mappingRecords[i];
		// 根据检查条件，在目标记录集合中查找
		var indexOfDest = _indexOfDestRecord(destRecords, mappingRecord, checkItems);
		var indexOfInsert = _indexOfDestRecord(insertRecords, mappingRecord, checkItems);
		var indexOfUpdate = _indexOfDestRecord(updateRecords, mappingRecord, checkItems);
		if (indexOfDest == -1 && indexOfInsert == -1 && indexOfUpdate == -1) {
			// 如果依然没有重复，那么就追加
			if (!emptyRecord) {
				//					emptyRecord = viewModel.getDataModule().createEmptyRecordByDS(destName, true);/
				var datasource = vds.ds.lookup(destName);
				var emptyRecord = datasource.createRecord();
			}
			// 使用克隆，防止调用createEmptyRecordByDS接口重新设置默认中，消耗性能
			//				var record = emptyRecord.createNew()
			var tempRecord = emptyRecord.clone();
			if (tempRecord.getMetadata().isContainField("id")) {
				tempRecord.set("id", vds.string.uuid());
			}
			var record = tempRecord;
			record = _setRecordValue(record, mappingRecords[i], fieldMapping);
			insertRecords.push(record);
			continue;
		}

		// 下面是存在重复记录的情况：
		if (operatorType == OPERATOR_TYPE.IGNORE) {
			// 如果是忽略，就啥也不干
			continue;
		}

		// 对于替换和合并，找到目标记录
		if (indexOfInsert != -1) {
			var destRecord = insertRecords[indexOfInsert];
		} else if (indexOfUpdate != -1) {
			var destRecord = updateRecords[indexOfUpdate];
		} else {
			var destRecord = destRecords[indexOfDest];
			updateRecords.push(destRecord);
			destRecords.splice(indexOfDest, 1);
		}

		if (operatorType == OPERATOR_TYPE.REPLACE) {
			// 复制源记录信息到目标记录，不包含比较字段
			_copyRecord(destRecord, mappingRecord, fieldMapping, checkItems);
		} else if (operatorType == OPERATOR_TYPE.MERGE) {
			// 复制源记录信息到目标记录，不包含比较字段，合并需要合并字段
			_copyRecord(destRecord, mappingRecord, fieldMapping, checkItems, mergeItems);
		}
	}

	if (insertRecords.length > 0) {
		var datasource = vds.ds.lookup(destName);
		var rs = datasource.insertRecords(insertRecords);
	}
	if (updateRecords.length > 0) {
		var datasource = vds.ds.lookup(destName);
		datasource.updateRecords(updateRecords)
	}

	return insertRecords.concat(updateRecords);
};

/**
 * 设置记录值
 * 
 * @param record
 *            记录
 * @param mappingRecord
 *            源字段信息
 * @param fieldMapping
 *            字段映射信息：决定需要复制哪些字段
 */
var _setRecordValue = function (record, mappingRecord, fieldMapping) {
	for (var i = 0; i < fieldMapping.length; i++) {
		var destField = fieldMapping[i].destName;
		var value = mappingRecord[destField];
		// id字段也可赋值
		// 注意这儿不检测value是否符合字段要求类型，而是由record.set内在进行适配
		record.set(destField, value);
	}
	return record;
};

/**
 * 复制源记录信息到目标记录，不包含比较字段
 */
var _copyRecord = function (destRecord, mappingRecord, fieldMapping, checkItems, mergeItems) {
	for (var i = 0; i < fieldMapping.length; i++) {
		var destField = fieldMapping[i].destName;
		var value = mappingRecord[destField];
		if (checkItems.indexOf(destField) != -1) {
			continue;
		}

		if (puller.getFieldName(destField).toLowerCase() == 'id') {
			throw new Error("替换或合并情况下，不允许对主键标识字段进行更新！");
		}

		if (mergeItems != null && mergeItems.indexOf(destField) != -1) {

			var field = destRecord.getMetadata().getFieldByCode(puller.getFieldName(destField));
			if (field == null) {
				throw new Error("配置错误！要合并的字段在目标实体不存在！destEntity="//
					+ destRecord.getDataSourceName() + ", destField=" + destField);
			}

			var fieldType = String(field.getType()).toLowerCase();
			if (['char', 'text', 'number', 'integer'].indexOf(fieldType) == -1) {
				throw new Error("配置错误！合并字段只支持char/text/number/integer，不支持字段类型：" + fieldType);
			}

			if (value == null) {
				// 要合并的值为null，则跳过
				continue;
			}

			var oldValue = destRecord.get(destField);
			if (oldValue == null) {
				// 注意这儿不检测value是否符合字段要求类型，而是由record.set内在进行适配
				destRecord.set(destField, value);
				continue;
			}

			if (fieldType == 'char' || fieldType == 'text') {
				destRecord.set(destField, oldValue + String(value));
			} else {
				// 数值类型：number / integer
				var avalue = parseFloat(value);
				if (avalue == null || isNaN(avalue)) {
					vds.log.warn("要合并的值不是合法的数值类型！已忽略。合并字段=" + destField + ", 合并值=" + value);
					continue;
				}
				destRecord.set(destField, oldValue + avalue);
			}
		} else {
			// 替换
			// 注意这儿不检测value是否符合字段要求类型，而是由record.set内在进行适配
			destRecord.set(destField, value);
		}
	}
}

/**
 * 根据匹配条件在目标记录集合中查找记录
 * 
 * @param destRecords
 *            目标记录集合
 * @param mappingRecord
 *            要查找的原始记录
 * @param checkItems
 *            记录匹配的判定条件
 * @return 查找到的记录索引， 如果未找到匹配记录，返回-1
 */
var _indexOfDestRecord = function (destRecords, mappingRecord, checkItems) {
	if (!checkItems || checkItems.length == 0) {
		throw new Error("配置错误！当操作类型为忽略、替换、合并时，重复检查字段必须提供！checkItems=" + checkItems);
	}
	try {
		for (var i = 0; i < destRecords.length; i++) {
			var destRecord = destRecords[i];
			var isMatch = true;
			for (var j = 0; j < checkItems.length; j++) {
				var checkItem = checkItems[j];
				var destValue = destRecord.get(checkItem);
				//					var fileItems = checkItem.split(".");
				//					var destValue = destRecord[fileItems[fileItems.length-1]];

				var mappingValue = mappingRecord[checkItem];
				if (mappingValue === undefined) {
					throw new Error("配置错误！重复检查字段必须包括在字段映射关系中！checkItem=" + checkItems[j]);
				}

				// 全等判断，避免0==''这种情况
				if (destValue !== mappingValue) {
					isMatch = false;
					break;
				}
			}
			if (isMatch) {
				return i;
			}
		}
		return -1;
	} catch (e) {
		vds.log.error("查找匹配记录错误！" + e.message);
		throw e;
	}
};

// 判断对象是否db对象
//	var _isDB = function(entityType, entityName) {
//		var isdb = false;
//		var dataType;
//		if (destType == "window") {
//			isdb = true;
//			dataType = "entity";
//		} else if (destType == "windowInput") {
//			dataType = viewContext.getWindowVariantType(entityName);
//		} else if (destType == "windowOutput") {
//			dataType = viewContext.getWindowOutputType(entityName);
//		} else if (destType == "ruleSetInput") {
//			dataType = viewContext.getInputParamType(entityName);
//		} else if (destType == "ruleSetOutput") {
//			dataType = viewContext.getOutPutParamType(entityName);
//		} else if (destType == "ruleSetVar") {
//			dataType = viewContext.getVariableType(entityName);
//		}
//		if (dataType == "entity")
//			isdb = true;
//	}

// ------1.0 End------

exports.main = main;

// 下面导出内容为单元测试使用
exports._getSourceEntityRecords = _getSourceEntityRecords;
exports._mappingRecords = _mappingRecords;
exports._mappingRecord = _mappingRecord;
exports._copyToDest = _copyToDest;
exports._indexOfDestRecord = _indexOfDestRecord;

export { main }