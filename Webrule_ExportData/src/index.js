/**
 * 文件导出 <code>
{
	"dataName" : "my_product_query",
	"dataType" : "Query",
	"dsColumnMap" : [{
				"chineseName" : "产品",
				"fieldName" : "productName",
				"needExport" : true,
				"orderBy" : "asc",
				"orderNo" : "2"
			}],
	"fileType" : "Excel",
	"template" : "",
	"title" : "\"产品销售情况表\"",
	"dsWhere" : [{
				"columnType" : "1",
				"displayField" : "season(season)",
				"displayValue" : "第 2 季度",
				"field" : "season",
				"fieldType" : "1",
				"leftBracket" : null,
				"logicOperation" : null,
				"operation" : " = ",
				"rightBracket" : null,
				"value" : "第 2 季度",
				"valueType" : "5"
			}],
	"dsQueryParam" : [{
				"componentControlID" : "d38294b4c81f49eeb99f3cc56d51fded",
				"queryfield" : "type",
				"queryfieldValue" : "JGTextBox5",
				"type" : "6"
			}]
}
 * </code>
 */

 vds.import("vds.object.*", "vds.exception.*", "vds.expression.*", "vds.message.*", "vds.ds.*");

var main = function (ruleContext) {
	return new Promise(function (resolve, reject) {
		try {
			var ruleConfig = ruleContext.getRuleCfg();
			var cfg = ruleContext.getVplatformInput();
			// 处理查询条件
			var condCfgs = cfg.dsWhere;
			var where = vds.ds.createWhere();
			if (condCfgs != null && condCfgs.length > 0) {
				where.addCondition(condCfgs);
			}
			//处理查询参数
			var params = {};
			if ('QUERY' == vds.string.toUpperCase(cfg.dataType)) {
				var queryParams = cfg.dsQueryParam;
				if (queryParams != null && queryParams.length > 0) {
					params = genCustomParams(queryParams, ruleContext);
				}
			}
			//处理标题表达式
			var title = '';
			if (cfg.title)
				title = vds.expression.execute(cfg.title, { "ruleContext": ruleContext });

			var option = {
				ruleInstId: ruleConfig.instanceCode,
				title: title,
				condSql: where.toWhere(),
				condParams: where.toParameters(),
				params: params,
				ruleConfig: vds.string.toJson(cfg)
			};

			var token = {
				data: option
			};
			var componentCode = vds.component.getCode();
			var windowCode = vds.window.getCode();
			var url = 'module-operation!executeOperation?componentCode=' + componentCode
				+ '&windowCode=' + windowCode
				+ '&operation=ExportData';

			/**
			 * 梁朝辉 2015-02-09
			 * 创建一个from用post的方法提交数据，防止url超长的问题
			 * token在createForm时处理
			 */
			// url += '&token=' + encodeURIComponent(encodeURIComponent(vds.string.toJson(token)));
			var iframeId = "file_down_iframe";
			var formId = "iframeDownForm"
			var tokenJson = vds.string.toJson(token);
			var tokenEncode = encodeURIComponent(tokenJson);
			createIFrame(iframeId, "");
			var formObj = createForm(formId, iframeId, url, tokenEncode);
			formObj.submit();
		} catch (ex) {
			reject(ex);
		}
	});
}

/**
* 梁朝辉 2015-02-09
* 创建一个from用post的方法提交数据，防止url超长的问题
*/
function createForm(formId, iframeId, actionUrl, tokenId) {
	var formObj = document.getElementById(formId);
	if (formObj == null) {
		formObj = document.createElement("form");
		formObj.setAttribute("id", formId);
		formObj.setAttribute("method", "post");
		formObj.setAttribute("target", iframeId);
		formObj.setAttribute("style", "display:none");
		document.body.appendChild(formObj);
	}
	formObj.setAttribute("action", actionUrl);
	formObj.innerHTML = "<input id='tokenId' type='hidden' name='token' value='" + tokenId + "'>";
	return formObj;
}

function createIFrame(iframeId, url) {
	var iframeObj = document.getElementById(iframeId);
	if (iframeObj == null) {
		iframeObj = document.createElement("iframe");
		iframeObj.setAttribute("id", iframeId);
		iframeObj.setAttribute("style", "display:none");
		document.body.appendChild(iframeObj);
	}
	iframeObj.setAttribute("src", url);
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


export { main }