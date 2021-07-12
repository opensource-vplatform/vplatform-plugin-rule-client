/**
 * 多语言操作
 */
/**
 *	
 */
 vds.import("vds.progress.*", "vds.message.*", "vds.i18n.*", "vds.expression.*", "vds.rpc.*", "vds.ds.*", "vds.widget.*", "vds.window.*", "vds.component.*", "vds.log.*", "vds.exception.*")
 /**
  * 规则入口
  */
 var main = function (ruleContext) {
	 return new Promise(function (resolve, reject) {
		 try {
			 var inParamObj = ruleContext.getVplatformInput();
			 if (!inParamObj) { //建议兼容
				 inParamObj = "";
			 }
			 var languageOperation = inParamObj.languageOperation,
				 returnMapping = inParamObj.returnMapping;
			 switch (languageOperation) {
				 case "getCurLanguage":
					 var value = localStorage.getItem(VPLATFORMI18NIDEN);
					 _setDataToObject(returnMapping, value, ruleContext, false);
					 resolve();
					 break;
				 case "getLanguages":
					 var params = {};
					 params["code"] = "InParams";
					 params["type"] = "object";
					 params["value"] = {
						 operation: "getAll",
					 };
					 var success = function (returnJson) {
						 if (returnJson && returnJson.data && returnJson.data.types) {
							 var types = returnJson.data.types;
							 _setDataToObject(returnMapping, types, ruleContext, true)
						 }
						 vds.progress.hide(true);
						 resolve();
					 }
					 success = ruleContext.genAsynCallback(success);
					 var error = function (returnJson) {
						 vds.progress.hide(true);
						 var promise = vds.message.error("无法获取语种列表." + (returnJson.msg ? " 错误信息：" + returnJson.msg : ""));
						 promise.then(resolve).catch(reject);
					 }
					 vds.progress.show(vds.i18n.get("正在获取语言列表", "获取语言列表时进度条的提示文字"), true);
					 InvokeCommand(params, success, error);
					 break;
				 case "setCurLanguage":
					 var value = vds.expression.execute(inParamObj.language, {
						 "ruleContext": ruleContext
					 });
					 if (null != value && "" != value) {
						 setLanguage(value);
					 } else {
						 var promise = vds.message.error("无法设置语言. 错误信息：语言编码为空");
						 promise.then(resolve).catch(reject);
					 }
					 break;
			 }
		 } catch (err) {
			 reject(err);
		 }
	 });
 }
 //cookie里i18n标识
 var VPLATFORMI18NIDEN = "langCookie";
 
 /**
  * 调用command
  * @param	{Object}	params	提交的参数
  * @param	{Function}	success	成功的回调
  * @param	{Function}	error	失败的回调
  * */
 var InvokeCommand = function (params, success, error) {
	 var promise = vds.rpc.callCommand("I18nOperation", [params], {
		 "isRuleSetCode": false
	 });
	 promise.then(success).catch(error);
 }
 
 /**
  * 把当前语言设置到localStorage
  * */
 function setLanguage(value) {
	 //		document.cookie = VPLATFORMI18NIDEN + "=" + value;
	 localStorage.setItem(VPLATFORMI18NIDEN, value);
	 // VMetrix.putAllVjsContext({//
	 // 	language: value
	 // }, 1);
	 window.location.reload();
 }
 
 
 // 创建游离 DB 对象信息
 var _createDBInfo = function (types) {
	 var len = 0;
	 var objs = [];
	 var len = types.length;
	 for (var i = 0; i < len; i++) {
		 var type = types[i];
		 var map = {};
		 map.id = i;
		 map.code = type.code;
		 map.name = type.name;
		 map.icon = type.icon;
		 objs.push(map);
	 }
 
	 var fields = [{
		 "code": "id",
		 "name": "id",
		 "length": 255,
		 "type": "char",
		 "defaultValue": "",
		 "precision": ""
	 }, {
		 "code": "code",
		 "name": "code",
		 "length": 255,
		 "type": "char",
		 "defaultValue": "",
		 "precision": ""
	 }, {
		 "code": "name",
		 "name": "name",
		 "length": 255,
		 "type": "char",
		 "defaultValue": "",
		 "precision": ""
	 }, {
		 "code": "icon",
		 "name": "icon",
		 "length": 255,
		 "type": "char",
		 "defaultValue": "",
		 "precision": ""
	 }];
	 var result = vds.ds.unSerialize(fields, {
		 "dsCode": "FreeLangListTb",
		 "datas": objs
	 });
	 return result;
	 /**
	  * 
	  * @param {Array<Object>} returnMapping
	  * @return {*}
	  */
 };
 var _setDataToObject = function (returnMapping, value, ruleContext, isEntity) {
	 if (returnMapping && returnMapping.length > 0) {
		 for (var i = 0; i < returnMapping.length; i++) {
			 var mapping = returnMapping[i],
				 dest = mapping["dest"];
 
			 var destType = mapping["destType"]; //目标类型（entity：实体，control：控件，windowVariant：窗体变量，systemVariant：系统变量）
			 var methodContext = ruleContext.getMethodContext();
			 // 目标对象为实体
			 if (isEntity) {
				 var freeDb = _createDBInfo(value),
					 srcRecords = freeDb.getAllRecords().toArray(),
					 destFieldMapping = mapping["destFieldMapping"],
					 updateDestEntityMethod = mapping["updateDestEntityMethod"],
					 isCleanDestEntityData = mapping["isCleanDestEntityData"];
				 var destEntity = getDatasource(dest, destType);
				 var newMappings = [];
				 for (var j = 0, len = destFieldMapping.length; j < len; j++) {
					 newMappings.push({
						 "code": destFieldMapping[j]["destField"],
						 "type": destFieldMapping[j]["srcValueType"],
						 "value": destFieldMapping[j]["srcValue"]
					 })
				 }
				 var isClear = false;
				 var mergeType;
				 switch (updateDestEntityMethod) {
					 case "loadRecord":
						 mergeType = vds.ds.MergeType.Load;
						 isClear = true;
						 break;
					 case "updateRecord":
						 mergeType = vds.ds.MergeType.Update;
						 break;
					 default:
						 mergeType = vds.ds.MergeType.InsertOrUpdate;
						 isClear = isCleanDestEntityData;
						 break;
				 }
				 vds.ds.merge(destEntity, srcRecords, newMappings, mergeType, methodContext, {
					 "isClear": isClear
				 });
			 } else {
				 switch (destType) {
					 case "control":
						 if (dest.indexOf(".") == -1) {
							 // 目标不存在.表示为单值控件
							 //兼容一些不是没有绑定数据库的控件，如：检索控件
							 vds.widget.execute(dest, "setValue", [value]);
						 } else {
							 // 目标存在.表示为多值控件
							 var widgetId = dest.split(".")[0];
							 var propertyCode = dest.split(".")[1];
							 vds.widget.execute(widgetId, propertyCode, [value]);
						 }
						 break;
					 case "windowVariant":
						 vds.window.setInput(dest, value);
						 break;
					 case "systemVariant":
						 vds.component.setVariant(dest, value);
						 break;
					 case "ruleSetVariant":
						 methodContext.setVariable(dest, value);
						 break;
					 case "ruleSetOutput":
						 methodContext.setOutput(dest, value);
						 break;
					 case "windowOutput":
						 // 给当前窗体输出变量赋值
						 vds.window.setOutput(dest, value);
						 break;
					 default:
						 vds.log.error("无效的目标类型：" + destType);
						 break;
				 }
			 }
		 }
	 }
 };
 /**
  * 获取数据源
  * @param {String} dsCode 数据源编码
  * @param {String} type 数据源类型
  * @param {@link MethodContext} methodContext 方法上下文
  * @return {@link Datasource} 数据源实例
  */
 var getDatasource = function (dsCode, type, methodContext) {
	 var err_msg = "";
	 var datasource;
	 switch (type) {
		 case "windowVariant": //窗体输入
		 case "windowInput":
			 datasource = vds.window.getInput(dsCode);
			 err_msg = "窗体输入";
			 break;
		 case "ruleSetVariant": //方法变量
			 datasource = methodContext.getVariable(dsCode);
			 err_msg = "方法变量";
			 break;
		 case "ruleSetOutput": //方法输出
			 datasource = methodContext.getOutput(dsCode);
			 err_msg = "方法输出";
			 break;
		 case "windowOutput": //窗体输出
			 datasource = vds.window.getOutput(dsCode);
			 err_msg = "窗体输出";
			 break;
		 default: //界面实体
			 datasource = vds.ds.lookup(dsCode);
			 err_msg = "";
			 break;
	 }
	 if (!datasource) {
		 throw vds.exception.newConfigException(err_msg + "实体【" + dsCode + "】不存在，请检查配置.");
	 }
	 return datasource;
 }
 
 export {
	 main
 }