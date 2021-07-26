/**
 * 将表（及从表）数据插入到其它表
 * <code>
 * {
 *	"items" : [{
 *				"condition" : [{
 *							"columnType" : "1",
 *							"displayField" : "产品(productName)",
 *							"displayValue" : "JGTextBox7",
 *							"field" : "my_products.productName",
 *							"fieldType" : "1",
 *							"leftBracket" : null,
 *							"logicOperation" : "",
 *							"operation" : " = ",
 *							"rightBracket" : null,
 *							"value" : "JGTextBox7",
 *							"valueType" : "6"
 *						}],
 *				"destTableName" : "my_products_consume",
 *				"itemsField" : [{
 *							"destField" : "my_products_consume.productName",
 *							"sourceField" : "SUBSTRING(my_products.productName, 0, 10) + 'test'",
 *							"sourcetype" : "4" //1--源表字段，2--系统变量，3--组件变量，4--SQL表达式，5--前台表达式，6--实体字段
 *						}],
 *				"sourceTableName" : "my_products",
 *				"refFK" : "B.masterID",		//从表的外键字段
 *				"masterPK" : "A.ID",	//主表的主键字段
 *				"isMasterTable" : false	//是否是主表
 *			}]
 * }
 * </code>
 */

vds.import("vds.component.*", "vds.ds.*", "vds.exception.*", "vds.expression.*", "vds.rpc.*", "vds.string.*", "vds.window.*");

var main = function (ruleContext) {
	return new Promise(function (resolve, reject) {
		try {
			var inParamObj = ruleContext.getVplatformInput();
			if (!check(inParamObj))
				return;

			var params = {
				condSqls: [], //查询条件
				condParams: [], //查询参数
				itemsField: [] //字段对应关系--对于系统变量、组件变量、前台表达式、实体字段参数要解析实际的值
			};
			if (inParamObj.items) {
				for (var i = 0; i < inParamObj.items.length; i++) {
					// 处理查询条件
					var condCfgs = inParamObj.items[i].condition;
					var condSqls = '';
					var condParams = {};
					if (condCfgs != null && condCfgs.length > 0) {
						var wrParam = {
							"type": vds.ds.WhereType.Query,
							"methodContext": ruleContext.getMethodContext()
						};
						var where = vds.ds.createWhere(wrParam);
						where.addCondition(condCfgs);
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
				}
			}
			params.items = inParamObj["items"];

			// 调用完活动集之后的回调方法
			var callback = function (responseObj) {
				if (responseObj.Success == false) {
					var ex = vds.exception.newBusinessException("将表（及从表）数据插入到其它表执行异常:" + responseObj.OutputMessage);
					reject(ex);
				}
				else {
					resolve();
				}
			};

			var sConfig = {
				"command": "CommonRule_DocumentsConverted",
				"datas": [{
					"code": "InParams",
					"type": "char",
					"Value": vds.string.toJson(params)
				}],
				"params": { "isAsyn": false, "ruleContext": ruleContext }
			}
			var promise = vds.rpc.callCommand(sConfig.command, params.datas, params.params);
			promise.then(callback).catch(callback);
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
			alert('[单据转换]规则配置有误：\n目标从表' + config.destTableName + '的外键字段必须指定。\n请在字段映射关系列表中进行配置。');
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
		if (itemsField[i].sourceField == srcRefFK)
			return true;
	}
	return false;
}

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