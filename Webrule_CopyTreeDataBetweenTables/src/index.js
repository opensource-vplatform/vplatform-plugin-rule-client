/**
 * 树形结构复制
 */

vds.import("vds.component.*", "vds.ds.*", "vds.expression.*", "vds.log.*", "vds.rpc.*", "vds.string.*", "vds.widget.*", "vds.window.*");

function main(ruleContext) {
	return new Promise(function (resolve, reject) {
		try {
			var inParamObj = ruleContext.getVplatformInput();
			if (!check(inParamObj)) {
				resolve();
			}

			var params = {
				condSqls: [], //查询条件
				condParams: [], //查询参数
				itemsField: [], //字段对应关系--对于系统变量、组件变量、前台表达式、实体字段参数要解析实际的值
				currId: '' //当前选中节点(要插入的目标节点Id)
			};

			for (var i = 0; i < inParamObj.items.length; i++) {
				//处理查询参数
				var condParams = {};
				var isSourceQuery = inParamObj.items[i].isSourceQuery;
				if (isSourceQuery == true || isSourceQuery == 'true') {
					var dsQueryParam = inParamObj.items[i].dsQueryParam;
					if (dsQueryParam != null && dsQueryParam.length > 0) {
						condParams = genCustomParams(dsQueryParam, ruleContext);
					}
				}

				// 处理查询条件
				var condCfgs = inParamObj.items[i].dsWhere;
				var condSqls = '';
				if (condCfgs != null && condCfgs.length > 0) {
					var wrParam = {
						"type": vds.ds.WhereType.Query,
						"methodContext": ruleContext.getMethodContext()
					};
					var where = vds.ds.createWhere(wrParam);
					where.addCondition(condCfgs);
					where.addParameters(condParams);
					condSqls = where.toWhere();
					condParams = where.toParameters();
				}
				params.condSqls.push(condSqls);
				params.condParams.push(condParams);

				//处理字段对应关系
				var itemsField = inParamObj.items[i].itemsField;
				var result = ParamField(itemsField, null, ruleContext);
				params.itemsField.push(result.itemsConverted);
				if (condParams != null) {
					var paramMap = result.paramMap;
					$.extend(condParams, paramMap);
				}

				//对于主表来说，处理当前选中节点
				var isInsertCurrentNode = inParamObj.items[i].isInsertCurrentNode;
				if (isInsertCurrentNode === true || isInsertCurrentNode === 'true') {
					var datasource = vds.ds.lookup(inParamObj.items[i].destTableName);
					var currRow = datasource.getCurrentRecord();
					//假如没有选中的节点，则复制到根节点下
					if (currRow) {
						params.currId = currRow.getSysId();
					}
				}
			}
			params.treeStruct = inParamObj["treeStruct"];
			params.items = inParamObj["items"];

			// 调用完活动集之后的回调方法
			var callback = function (responseObj) {
				if (responseObj.Success == false) {
					throw new Error("树形结构表间数据复制执行异常:" + result.msg);
				}
				resolve();
			};

			var sConfig = {
				"command": "CommonRule_CopyTreeDataBetweenTables",
				"datas": [{
					"code": "InParams",
					"type": "char",
					"value": vds.string.toJson(params)
				}],
				"params": { "isAsyn": false, "ruleContext": ruleContext }
			}
			var promise = vds.rpc.callCommand(sConfig.command, sConfig.datas, sConfig.params);
			promise.then(callback).catch(reject);

		} catch (ex) {
			reject(ex);
		}
	});
}

/**
 * 配置检查
 */
function check(inParamObj) {
	if (!checkMasterIdField(inParamObj))
		return false;
	else
		return true;
}

/**
 * 要求 对于从表来说，必须指定目标表的外键字段(维持目标表主从关系时需要知道)
 * 
 * 目前的配置方式，没有指定从表目标表的外键字段，从表的外键字段是通过itemsField获取的；
 * 这种配置方式不明显，很容易使人遗漏，所以特别检查并提示。
 */
function checkMasterIdField(inParamObj) {
	var items = inParamObj.items;
	for (var i = 0; i < items.length; i++) {
		// 主表或者某一个从表的规则配置
		var config = items[i];
		if (config.isMasterTable == true || config.isMasterTable == 'true') {
			//主表不需要检查
			continue;
		}

		if (!checkItemsFieldContainsSrcRefFK(config.itemsField, config.refFK)) {
			alert('[树形结构表间数据复制]规则配置有误：\n目标从表' + config.destTableName + '的外键字段必须指定。\n请在字段映射关系列表中进行配置。');
			return false;
		}
	}

	return true;
}

/**
 * 检查ItemsField中，源表是否包含指定的名称
 */
function checkItemsFieldContainsSrcRefFK(itemsField, srcRefFK) {
	for (var i = 0; i < itemsField.length; i++) {
		if (itemsField[i].sourceField == srcRefFK) return true;
	}
	return false;
}


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


//#region ParamFieldUtil 实现

var ParamField = function (itemsField, mapping, ruleContext) {
	var itemsConverted = [];
	var paramMap = {};

	mapping = mapping || {
		destField: 'destField',
		sourceField: 'sourceField',
		sourcetype: 'sourcetype'
	};

	for (var i = 0; i < itemsField.length; i++) {
		_convertField(itemsField[i], ruleContext, mapping, itemsConverted, paramMap);
	}

	return { "itemsConverted": itemsConverted, "paramMap": paramMap };
}

/*转换一个字段、并且添加转换后的结果到this变量中*/
var _convertField = function (field, ruleContext, mapping, itemsConverted, paramMap) {
	var sourceField = _getSourceField(field, mapping);
	switch (_getSourcetype(field, mapping)) {
		case 'tableField'://1--SQL字段
			_pushOldField(field, itemsConverted, paramMap);
			break;
		case '1'://1--SQL字段
			_pushOldField(field, itemsConverted, paramMap);
			break;
		case '2'://2--系统变量
			var paramValue = vds.component.getVariant(sourceField);
			_pushParamField(field, paramValue, mapping, itemsConverted, paramMap);
			break;
		case '3'://3--组件变量
			var paramValue = vds.window.getInput(sourceField);
			_pushParamField(field, paramValue, mapping, itemsConverted, paramMap);
			break;
		case '4': //4--SQL表达式
			var newSourceField = vds.expression.execute(sourceField, { "ruleContext": ruleContext });
			_setSourceField(field, newSourceField, mapping);
			_pushOldField(field, itemsConverted, paramMap);
			break;
		case '5'://5--前台表达式
			var paramValue = vds.expression.execute(sourceField, { "ruleContext": ruleContext });
			_pushParamField(field, paramValue, mapping, itemsConverted, paramMap);
			break;
		case 'expression'://5--前台表达式
			var paramValue = vds.expression.execute(sourceField, { "ruleContext": ruleContext });
			_pushParamField(field, paramValue, mapping, itemsConverted, paramMap);
			break;
		case '6'://6--实体字段
			var dataSourceName = _getTableName(sourceField);
			var fieldName = _getFieldName(sourceField);
			var datasource = manager.lookup(dataSourceName);
			var record = datasource.getCurrentRecord();
			var paramValue = record.get(fieldName);
			_pushParamField(field, paramValue, mapping, itemsConverted, paramMap);
			break;
		default:
			_pushOldField(field, itemsConverted, paramMap);
	}
};

var _pushOldField = function (field, itemsConverted, paramMap) {
	itemsConverted.push($.extend({}, field));
};

var _pushParamField = function (field, paramValue, mapping, itemsConverted, paramMap) {
	var paramName = _genParamName(_getDestField(field, mapping));
	var item = $.extend({}, field);
	item[mapping.sourceField] = ':' + paramName;
	itemsConverted.push(item);
	paramMap[paramName] = paramValue;
};

var _genParamName = function (fieldName) {
	var name = fieldName.replace(/[.]/g, '_');
	return name + '_' + vds.string.uuid();
};

var _getDestField = function (item, mapping) {
	return item[mapping.destField];
};

var _getSourceField = function (item, mapping) {
	return item[mapping.sourceField];
};

var _setSourceField = function (item, newSourceField, mapping) {
	item[mapping.sourceField] = newSourceField;
};

var _getSourcetype = function (item, mapping) {
	return item[mapping.sourcetype];
};

var _getTableName = function (field) {
	var retvalue = field;
	if (field.indexOf(".") != -1) {
		retvalue = field.split(".")[0];
	}
	return retvalue;
}

var _getFieldName = function (field) {
	var retvalue = field;
	if (field.indexOf(".") != -1) {
		retvalue = field.split(".")[1];
	}
	return retvalue;
}

//#endregion


export { main }