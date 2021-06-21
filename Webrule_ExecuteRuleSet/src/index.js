/**
 *  执行活动集
 *  业务逻辑：
 *  1，参数处理：
 *  	1）活动集入参处理：若为实体类型时，需根据映射关系克隆出一个新的DB。
 *  	2）活动集出参处理：执行活动集的结果和出参进行匹配，此处理逻辑放在回调函数中。
 *  	3）搜索窗体实体scopeIds：若执行窗体活动集，则需根据容器和tab名称搜索对应的窗体实例scopeId。
 *  2，执行loacal活动集时，直接调用前端框架API executeRoute。
 *  3，执行api/extensionPoint活动集时，表示构件间通信，则从服务中介Mediator调用对应活动集。
 */

	var formulaEngine,
		ExpressionContext,
		scopeManager,
		dbService,
		exceptionFactory,
		datasourceManager,
		widgetProperty,
		datasourceFactory,
		routeEngine,
		RouteContext,
		jsonUtil,
		log,
		mediator,
		componentParam,
		windowParam,
		componentInit,
		widgetDatasource,
		uuid,
		datasourcePusher,
		widgetContext,
		widgetAction,
		widgetRelation,
		ScopeTask,
		componentPackData,
		ruleEngine,
		TaskManager,
		sandBox,appData,snapshotManager;

	exports.initModule = function(sBox) {
		sandBox = sBox;
		log = sBox.getService("vjs.framework.extension.util.log");
		scopeManager = sBox.getService("vjs.framework.extension.platform.interface.scope.ScopeManager");
		ruleEngine = sBox.getService("vjs.framework.extension.platform.engine.rule.RuleEngine");
		dbService = sBox.getService("vjs.framework.extension.platform.services.view.logic.datasource.DatasourceUtil");
		formulaEngine = sBox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionEngine");
		ExpressionContext = sBox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionContext");
		exceptionFactory = sBox.getService("vjs.framework.extension.platform.interface.exception.ExceptionFactory");
		datasourceManager = sBox.getService("vjs.framework.extension.platform.services.model.manager.datasource.DatasourceManager");
		datasourceFactory = sBox.getService("vjs.framework.extension.platform.interface.model.datasource.DatasourceFactory");
		routeEngine = sBox.getService("vjs.framework.extension.platform.engine.route.RouteEngine");
		RouteContext = sBox.getService("vjs.framework.extension.platform.interface.route.RouteContext");
		jsonUtil = sBox.getService("vjs.framework.extension.util.JsonUtil");
		mediator = sBox.getService("vjs.framework.extension.system.mediator");
		componentParam = sBox.getService("vjs.framework.extension.platform.services.param.manager.ComponentParam");
		windowParam = sBox.getService("vjs.framework.extension.platform.services.param.manager.WindowParam");
		componentInit = sBox.getService("vjs.framework.extension.platform.services.init.ComponentInit");
		widgetProperty = sBox.getService("vjs.framework.extension.platform.services.view.widget.common.action.WidgetProperty");
		widgetDatasource = sBox.getService("vjs.framework.extension.platform.services.view.widget.common.logic.datasource.WidgetDatasource");
		uuid = sBox.getService("vjs.framework.extension.util.UUID");
		datasourcePusher = sBox.getService("vjs.framework.extension.platform.services.domain.datasource.DatasourcePusher");
		appData = sBox.getService("vjs.framework.extension.platform.services.param.manager.ApplicationParam");
		snapshotManager = sBox.getService("vjs.framework.extension.platform.data.manager.runtime.snapshot.snapshotManager");
		widgetContext = sBox.getService("vjs.framework.extension.platform.services.view.widget.common.context.WidgetContext");
		widgetAction = sBox.getService("vjs.framework.extension.platform.services.view.widget.common.action.WidgetAction");
		widgetRelation = sBox.getService("vjs.framework.extension.platform.services.view.widget.common.relation.WidgetRelation");
		ScopeTask = sBox.getService("vjs.framework.extension.platform.global.task.ScopeTask");
		componentPackData = sBox.getService('vjs.framework.extension.platform.global.data.ComponentPackData');
		TaskManager = sBox.getService("vjs.framework.extension.platform.global.task.TaskManager");
	}

	var main = function(ruleContext) {
		//获取规则上下文中的规则配置值
		var routeContext = ruleContext.getRouteContext();
		var args = routeContext.getEventArguments();
		//处理规则的入参
		var ruleCfgValue = ruleContext.getRuleCfg();
		var inParams = ruleCfgValue["inParams"];
		var inParamsObj = jsonUtil.json2obj(inParams);
		var invokeTarget = inParamsObj["invokeTarget"];
		processRuleLocation(invokeTarget);
		var invokeParams = inParamsObj["invokeParams"];
		var returnMapping = inParamsObj["returnMapping"];
		var filter = inParamsObj["filter"];
		//设置并行属性（默认为false）
		var isRuleAsyn = false;
		if(invokeTarget.isParallelism){
			var ruleAsyn = invokeTarget.isParallelism;
			if(ruleAsyn.toLowerCase() == "true"){
				isRuleAsyn = true;
			}
		}
		//如果方法并行执行，则不建立父子关系 add by xiedh 2018-05-31  解决事务问题
		var parentRouteContext = isRuleAsyn ? null:routeContext;
		var currRouteRuntime = new RouteContext(null, parentRouteContext); //routeRuntime.init();
		if(typeof(currRouteRuntime.setParentRuleContext)=="function") {
			currRouteRuntime.setParentRuleContext(ruleContext);
		}
		currRouteRuntime.putEventArgument(args);
		//获取invokeTarget属性
		var componentCode = invokeTarget.componentCode;
		var windowCode = invokeTarget.windowCode;
		var sourceType = invokeTarget.sourceType;
		var ruleSetCode = invokeTarget.ruleSetCode;
		var invokeType = invokeTarget.invokeType;

		if (!ruleSetCode) {
			throw Error("[ExecuteRuleSet.main]执行活动集规则出错：不存在ruleSetCode！");
		}
				
		var func = (function(){
			return function(){
				
				//处理活动集返回结果
				var scopeId = scopeManager.getCurrentScopeId();
				var setOutputFunc = _setOutputFunc(scopeId,returnMapping,ruleContext,routeContext,currRouteRuntime);
				var fireRouteCallbackFunc = _fireRouteCallback(scopeId,ruleContext,isRuleAsyn);
				var callback = function(resultFromExeRuleSet) {
					//如果当前域已效果再去执行返回值设置会引发问题，Task20200917109 xiedh 2020-09-23
					var isActionListNormalWork = false;
					if(scopeManager.isDestroy(scopeId)){
						routeContext.markForInterrupt(routeContext.GLOBAL);
					}else{
						isActionListNormalWork = setOutputFunc(resultFromExeRuleSet);
					}
					fireRouteCallbackFunc();
					return isActionListNormalWork;
				}
				//TODO xiedh
				//ruleContext.setRuleCallbackFireFlag(true);
				//---------------------------执行活动集:本地的走框架API，构件间的走中介服务--------------------------------------
				var config = {};
				var instanceRefs = [];
				if (filter && filter["windowInstanceCode"]) {
					var context = new ExpressionContext();
					context.setRouteContext(routeContext);
					var value = formulaEngine.execute({
						"expression": filter["windowInstanceCode"],
						"context": context
					});
					instanceRefs.push(value);
				}
				config["instanceRefs"] = instanceRefs;
				config["parentRouteContext"] = parentRouteContext;
				config["currentRouteContext"] = currRouteRuntime;
				config["callback"] = callback;
				var serviceName = mediator.getServiceName(componentCode, windowCode, ruleSetCode, sourceType);
				switch (invokeType) {
					case "spi":
					case "local":
						config.error=scopeManager.createScopeHandler({
							handler: function(e){
								var exception = e;
								if(!exceptionFactory.isException(exception)){
									exception = ruleEngine.createRuleException({
										ruleContext: ruleContext,
										exception:exception
									});
								}
								ruleContext.handleException(exception);
							}
						});
						var inputParam = parseParam(invokeParams, componentCode, windowCode, ruleSetCode, invokeType, sourceType, routeContext);
						routeEngine.execute({
							"targetConfig": invokeTarget,
							"inputParam": inputParam,
							"config": config
						});
						break;
					case "api":
						if("server-ruleSet" == sourceType){
							var inputParam = parseParam(invokeParams, componentCode, windowCode, ruleSetCode, invokeType, sourceType, routeContext);
							routeEngine.execute({
								"targetConfig": invokeTarget,
								"inputParam": inputParam,
								"config": config
							});
						}else{
							//调用目标构件的活动集在中介服务中不存在时,则先行加载目标构件模块,并将目标构建的API信息注册到中介服务
							var scopeId = scopeManager.getCurrentScopeId();
							var publishCallback = function() {
								//如果加载目标构件后，仍未向中介服务注册API，则报错！说明目标构件没有导出API
								try{
									var checkAgaingServece = mediator.isExistService(serviceName);
									if (checkAgaingServece) {
										//生成活动集入參需要在调用点域中，comment by xiedh 2015-09-16
										scopeManager.openScope(scopeId);
										snapshotManager.begine(routeContext.snapshotId);
										var inputParam = parseParam(invokeParams, componentCode, windowCode, ruleSetCode, invokeType, sourceType, routeContext);
										scopeManager.closeScope();
										snapshotManager.end();
										mediator.publish(serviceName, [inputParam, config]);
									} else {
										throw scopeManager.createScopeHandler({
											scopeId : scopeId,
											handler: function(){
												return ruleEngine.createRuleException({
													ruleContext: ruleContext,
													exception: new Error("执行目标构件活动集出错！请检查目标构件:" + componentCode + "是否包含此API:" + ruleSetCode, undefined, undefined, exceptionFactory.TYPES.Config)
												})
											}
										})();
//										throw new Error("执行目标构件活动集出错！请检查目标构件:" + componentCode + "是否包含此API:" + ruleSetCode);
									}
								}catch(e){
									ruleContext.handleException(e);
								}
							}
							var errorPublishCallback = function(e) {
									var message = e ? e.message:"执行目标构件活动集出错！请检查目标构件:" + componentCode + "是否已部署！";
									e = new Error(message);
									ruleContext.handleException(e);
								}
								//actionHandler.executeComponentAction("getComponentByCode",componentCode,publishCallback,errorPublishCallback);
							var tmpMapping = componentPackData.getMapping({
								componentCode : componentCode,
								code : ruleSetCode
							});
							if(null != tmpMapping){
								componentCode = tmpMapping.componentCode;
								ruleSetCode = tmpMapping.funcCode;
								serviceName = mediator.getServiceName(componentCode, windowCode, ruleSetCode, sourceType);
							}
							componentInit.initComponent({
								"componentCode": componentCode,
								"success": publishCallback,
								"error": errorPublishCallback
							});
						}
						break;
					case "extensionPoint":
						var isExistService = mediator.isExistService(serviceName);
						if (isExistService) {
							//ep执行条件参数
							var epConditionParams = getEpConditionParams(inParamsObj.epConditionParam,routeContext);
							epConditionParams["#invokeScope#"] = handleInvokeScope(invokeTarget.invokeScope)
							var inputParam = parseParam(invokeParams, componentCode, windowCode, ruleSetCode, invokeType, sourceType, routeContext);
							config["callback"] = setOutputFunc;
							mediator.publishSerializable(serviceName, [inputParam, config, epConditionParams],fireRouteCallbackFunc);
						} else {
							//throw new BusinessException("执行活动集出错(扩展点),请先打开目标组件容器！");
							log.warn("该扩展点实现未找到[构件编号:" + componentCode + "窗体编号:" + windowCode + "活动集名称：" + ruleSetCode + "请检查服务映射信息是否发布或对应窗体是否已打开!");
							ruleContext.fireRuleCallback();
							//将扩展点与实现之间的映射信息拆分后，会出现找不到实现信息的情况（之前是合并在一起，一定能找到，但可能找不到满足条件实现），如果找不到实现，则执行后续规则 xiedh 2020-07-17
							fireRouteCallbackFunc();
						}
						break;
				}
		  }
		})();
		ruleContext.markRouteExecuteUnAuto();
		if(isRuleAsyn){//并行处理异步域任务
			var scopeId = scopeManager.getCurrentScopeId();
			var task = new ScopeTask(scopeId,true,func);
			TaskManager.addTask(task);
			ruleContext.fireRouteCallback();
		}else{
			func();
		}	
	};
	
	/**
	 * 获取激活子窗体信息
	 */
	var getActiveChildScope = function(){
		var childWindowInfos = [];
		var windowScope = scopeManager.getWindowScope();
		var windowCode = windowScope.getWindowCode();
		var relationWidgets = scopeManager.createScopeHandler({
			scopeId : windowScope.getInstanceId(),
			handler : function(){
				return widgetRelation.get(windowCode, false, widgetRelation.WIDGET_RELATION);
			}
		})();
		if(relationWidgets){
			childWindowInfos = [];
			var exeFunc = scopeManager.createScopeHandler({
				scopeId: windowScope.getInstanceId(),
				handler: function(sourceCodes, funName) {
					var results = [];
					for (var i = 0, len = sourceCodes.length; i < len; i++) {
						var childWidgetCode = sourceCodes[i];
						var widgetObj = widgetContext.get(childWidgetCode, "widgetObj");
						var tmpActiveChilds;
						if (widgetObj && typeof widgetObj[funName] == "function")
							tmpActiveChilds = widgetObj[funName]();
						else if (widgetAction.isWidgetActionExist(childWidgetCode, funName))
							tmpActiveChilds = widgetAction.executeWidgetAction(childWidgetCode, funName);
						if (tmpActiveChilds)
							for (var j = 0, l = tmpActiveChilds.length; j < l; j++) {
								var code = tmpActiveChilds[j];
								if (results.indexOf(code) == -1)
									results.push(code)
							}
					}
					return results
				}
			});
			//筛选激活子控件编码
			var activeChildCodes = exeFunc(relationWidgets, "getActiveChildWidgets");
			//筛选激活的子窗体域
			var activeScopeIds = exeFunc(activeChildCodes, "getActiveChildWindows");
			for(var i = 0,len = activeScopeIds.length;i<len;i++){
				var scopeId = activeScopeIds[i];
				var tmpScope = scopeManager.getScope(scopeId);
				childWindowInfos.push({
					componentCode : tmpScope.getComponentCode(),
					windowCode : tmpScope.getWindowCode(),
					scopeId : scopeId
				});
			}
		}
		return childWindowInfos;
	}

	var getSelfScope = function(){
		var scopeId = scopeManager.getCurrentScopeId();
		var tmpScope = scopeManager.getScope(scopeId);
		return {
			componentCode : tmpScope.getComponentCode(),
			windowCode : scopeManager.isWindowScope(scopeId) ? tmpScope.getWindowCode():null,
			scopeId : scopeId
		};
	}
	
	/**
	 * 处理执行范围
	 * @param {String} invokeScope 范围参数
	 * */
	var handleInvokeScope = function(invokeScope){
		var childWindowInfos = null;//null 表示没有配置执行范围，如果有配置执行范围，那就是数组
		if(invokeScope == "activeChild"){
			childWindowInfos = getActiveChildScope();
		}else if(invokeScope == "selfAndActiveChild"){
			childWindowInfos = [];
			/**
			 * 执行本窗体及子窗体扩展点，如果当前域为构件域，则该构件的扩展点实现也执行。确认人：weicl
			 */
			var scopeId = scopeManager.getCurrentScopeId();
			if(scopeManager.isComponentScope(scopeId)){
				var info = scopeManager.createScopeHandler({
					scopeId:scopeId,
					handler:getSelfScope
				})();
				childWindowInfos.push(info);
			}
			var scope = scopeManager.getWindowScope();
			if(scope){
				var scopeId = scope.getInstanceId();
				var info = scopeManager.createScopeHandler({
					scopeId:scopeId,
					handler:getSelfScope
				})();
				childWindowInfos.push(info);
			}
			childWindowInfos = childWindowInfos.concat(getActiveChildScope());
		}else if(invokeScope == "selfAndChildren"){
			childWindowInfos = [];
			var scopeId = scopeManager.getCurrentScopeId();
			if(scopeManager.isComponentScope(scopeId)){
				var info = scopeManager.createScopeHandler({
					scopeId:scopeId,
					handler:getSelfScope
				})();
				childWindowInfos.push(info);
			}
			var scope = scopeManager.getWindowScope();
			if(scope){
				var scopeId = scope.getInstanceId();
				var info = scopeManager.createScopeHandler({
					scopeId:scopeId,
					handler:getSelfScope
				})();
				childWindowInfos.push(info);
			}
			var windowScope = scopeManager.getWindowScope();
			var childScopes = scopeManager.getChildrenScopes(windowScope.getInstanceId());
			if(childScopes){
				for(var i = 0,len = childScopes.length;i<len;i++){
					var childScope = childScopes[i];
					var scopeId = childScope.getInstanceId();
					if(scopeManager.isWindowScope(scopeId)){
						childWindowInfos.push({
							componentCode : childScope.getComponentCode(),
							windowCode : childScope.getWindowCode(),
							scopeId : scopeId
						});
					}
				}
			}
		}
		return childWindowInfos;
	}
	
	var _setOutputFunc = function(scopeId,returnMapping,ruleContext,routeContext,currRouteRuntime){
		return function(resultFromExeRuleSet,epImpInfo) {
				scopeManager.openScope(scopeId);
				if (returnMapping && returnMapping.length > 0) {
					var tmpAllComponentVar = [];
					for (var i = 0; i < returnMapping.length; i++) {
						var tmpSimpleComponent = {};
						var mapping = returnMapping[i];
						var dest = mapping["dest"]; //目标名称
						if (!dest) {
							throw Error("[ExecuteRuleSet.main]执行活动集规则出错：返回值设置目标不能为空！");
						}
						var destType = mapping["destType"]; //目标类型（entity：实体，control：控件，windowVariant：窗体变量，systemVariant：系统变量）
						var src = mapping["src"]; //来源(returnValu:返回值，expression:表达式)
						var srcType = mapping["srcType"]; //来源(当目标类型是实体时，返回实体存在此处)
						var value = null;
						if (srcType == "returnValue") {
							value = resultFromExeRuleSet[src];
						} else if (srcType == "expression") {
							var context = new ExpressionContext();
							context.setRouteContext(currRouteRuntime);
							value = formulaEngine.execute({
								"expression": src,
								"context": context
							});
						}
						var extraParams = {};
						//扩展点信息
						if(epImpInfo){
							extraParams.epImpInfo = {
									"#componentCode#":epImpInfo.componentCode,
									"#windowCode#":epImpInfo.windowCode,
									"#methodCode#":epImpInfo.ruleSetCode,
							};
							extraParams.returnDatas = resultFromExeRuleSet;
						}else{
							extraParams.epImpInfo = {};
						}
						/**
						 * 2015-05-09 liangchaohui：<br>
						 * 修改insertOrUpdateRecords2Entity，操作类型为更新时，如果目标实体没有匹配id的记录，则不做任何操作，原来没匹配id时会新增记录<br>
						 * 如果目标是实体类型时，走dbService.insertOrUpdateRecords2Entity，如果是其他类型，则走原来直接赋值的逻辑<br>
						 * 原来case "entity"分支，由于目标是实体类型，所以已经抽到dbService.insertOrUpdateRecords2Entity中实现，所以在else分支中删除该逻辑<br>
						 */
						if (dbService.isEntity(dest, destType, ruleContext)) {
							var destFieldMapping = mapping["destFieldMapping"];
							var updateDestEntityMethod = mapping["updateDestEntityMethod"];
							if (updateDestEntityMethod == null) {
								updateDestEntityMethod = "insertOrUpdateBySameId";
							}
							var isCleanDestEntityData = mapping["isCleanDestEntityData"];
							var srcRecords;
							if(src == "#fieldEntity#"){//特殊类型
								extraParams.sourceType = "fieldEntity";
								srcRecords = [{}];//只一条记录
							}else{
								if(null == value){
									//如果是ep实现，并且ep实现没有对应的实体输出，就暂时不处理
									if(epImpInfo){
										continue;
									}else{
//										var exception = new Error("返回值的来源实体【"+src+"】不存在", undefined, undefined,exceptionFactory.TYPES.Config);
//										ruleContext.handleException(exception);
										throw ruleEngine.createRuleException({
											ruleContext: ruleContext,
											exception: new Error("返回值的来源实体【"+src+"】不存在", undefined, undefined, exceptionFactory.TYPES.Config)
										})
									}
								}
								srcRecords = value.getAllRecords();
							}
							dbService.insertOrUpdateRecords2Entity(dest, destType, srcRecords, destFieldMapping, updateDestEntityMethod, isCleanDestEntityData, ruleContext,extraParams);
						} else {
							switch (destType) {
								case "windowVariant":
									windowParam.setInput({
										"code": dest,
										"value": value
									});
									break;
								case "systemVariant":
									/*
									 * time 2017-01-04
									 * author liangzc
									 * desc 逻辑优化，把全部构件变量保存起来，最后统一调用后台处理。
									 * */
									tmpSimpleComponent["code"] = dest;
									tmpSimpleComponent["value"] = value;
									tmpAllComponentVar.push(tmpSimpleComponent);
//									componentParam.setVariant({
//										"code":dest,
//										"value":value
//									});
									break;
								case "control":
									setWidgetValue(dest, value);
									break;
								case "ruleSetVariant":
									routeContext.setVariable(dest, value);
									break;
								case "ruleSetOutput":
									routeContext.setOutputParam(dest, value);
									break;
								case "windowOutput":
									windowParam.setOutput({
										"code": dest,
										"value": value
									});
									break;
								default:
									log.error("无效的目标类型：" + destType);
									break;
							}
						}
					}
					/*调用批量设置构件变量的接口*/
					if(undefined != tmpAllComponentVar && tmpAllComponentVar.length>0){
						componentParam.setVariants(tmpAllComponentVar);
					}
				}
				//设置业务返回值
				var isActionListNormalWork = true;
				var interruptType = currRouteRuntime.getInterruptType();
				/* 如果被调用的活动集执行了中断规则，这里会识别出中断了当前活动集执行
				 	        这样的话，需要把这个状态记录为执行活动集不是正常工作*/
				if (interruptType == currRouteRuntime.CURRENT) {
					isActionListNormalWork = false;
				}
				if (ruleContext.setBusinessRuleResult) {
					ruleContext.setBusinessRuleResult({
						isActionListNormalWork: isActionListNormalWork
					});
				}
				scopeManager.closeScope();
				return isActionListNormalWork;
			};
	}
	
	var _fireRouteCallback = function(scopeId,ruleContext,isRuleAsyn){
		return function(){
			scopeManager.openScope(scopeId);
			ruleContext.fireRuleCallback();
			if(!isRuleAsyn){//如果设置了串行，则重新设置路由回调
				ruleContext.fireRouteCallback();
			}
			scopeManager.closeScope();
		}
	}

	/**
	 * 创建游离DB
	 */
	var getFreeDB = function(fieldsMapping) {
		var json = createJsonFronConfig(fieldsMapping);
		return datasourceFactory.unSerialize(json);
	}

	var createJsonFronConfig = function(params) {
		var fields = [];
		var freeDBName = "freeDB_" + uuid.generate();
		for (var i = 0, l = params.length; i < l; i++) {
			var param = params[i];
			fields.push({
				"code": param.code,
				"name": param.name,
				"type": param.type,
				"defaultValue": param.initValue
			});
		}
		return {
			"datas": {
				"values": []
			},
			"metadata": {
				"model": [{
					"datasource": freeDBName,
					"fields": fields
				}]
			}
		};
	}
	/**
	 * 解析扩展点条件参数
	 * */
	var getEpConditionParams = function(sourceParams, routeContext){
		var datas = {};
		if(sourceParams){
			for(var i = 0,len = sourceParams.length;i<len;i++){
				var param = sourceParams[i];
				var code = param.paramCode;
				var value = param.paramValue;
				if(null != value && "" != value){
					var context = new ExpressionContext();
					context.setRouteContext(routeContext);
					value = formulaEngine.execute({
						"expression": value,
						"context": context
					});
				}
				datas[code] = value;
			}
		}
		return datas;
	}
	
	/**
	 * 参数解析
	 */
	var parseParam = function(invokeParams, componentCode, windowCode, ruleSetCode, invokeType, sourceType, routeContext) {
		var param = {};
		//获取活动集配置
		var ruleSetConfig;
		if (windowCode) {
			var windowRoute = sandBox.getService("vjs.framework.extension.platform.data.storage.schema.route.WindowRoute");
			ruleSetConfig = windowRoute.getRoute({
				"componentCode": componentCode,
				"windowCode": windowCode,
				"routeCode": ruleSetCode
			});
		} else {
			var componentRoute = sandBox.getService("vjs.framework.extension.platform.data.storage.schema.route.ComponentRoute");
			ruleSetConfig = componentRoute.getRoute({
				"componentCode": componentCode,
				"routeCode": ruleSetCode
			});
		}
		for (var i = 0; invokeParams != null && i < invokeParams.length; i++) {
			var invokeObj = invokeParams[i];
			//实体来源：1，父活动集的输入变量中的实体 2，父活动集的上下文变量 中的实体3，窗体实体
			var paramCode = invokeObj["paramCode"];
			var paramSource = invokeObj["paramSource"];
			//参数类型，expression:表达式，entity:实体
			var paramType = invokeObj["paramType"];
			var value = invokeObj["paramValue"];
			//获取前台实体数据方式，modify:修改过的(新增,修改或删除的)，all:(默认,新增,修改或删除的)
			var dataFilterType = invokeObj["dataFilterType"];
			var paramFieldMapping = invokeObj["paramFieldMapping"];
			//参数实体字段类型
			var paramFieldTypes = [];
			//删除的记录id
			var deleteIds = [];
			if (paramCode == null || paramCode == "")
				throw new Error("输入参数名不能为空");
			if (paramType == "expression") {
				if (value != null && value != "") {
					var context = new ExpressionContext();
					context.setRouteContext(routeContext);
					param[paramCode] = formulaEngine.execute({
						"expression": value,
						"context": context
					});
				}
			} else if (paramType == "entity") {
				var entityName = value;
				//校验
				if (paramFieldMapping == null || paramFieldMapping.length == 0)
					throw new Error("输入参数类型为实体时，参数实体字段映射不能为空");
				for (var k = 0; paramFieldMapping != null && k < paramFieldMapping.length; k++) {
					var paramEntityField = paramFieldMapping[k]["paramEntityField"];
					//字段值(字段值类型为field时为前台实体的字段,否则为表达式)
					var fieldValue = paramFieldMapping[k]["fieldValue"];
					//field:前台实体字段,expression:表达式
					var fieldValueType = paramFieldMapping[k]["fieldValueType"];
					if (paramEntityField == null || paramEntityField == "") {
						throw new Error("输入参数类型为实体时，参数实体字段不能为空");
					}
					if (fieldValueType == "entityField" && (fieldValue == null || fieldValue == "")) {
						throw new Error("输入参数类型为实体时，来源字段配置不能为空");
					}
				}
				var fieldsMapping =  [];
				if("server-ruleSet" == sourceType){
					for (var j = 0; j < paramFieldMapping.length; j++) {
						var fMapping = paramFieldMapping[j];
						var fCode = fMapping.paramEntityField;
						var fType = "any";
						var entityEle = {
								"code" : fCode,
								"type" : "any",
								"name" : "",
								"configs":null
						}
						fieldsMapping.push(entityEle);
					}
				}else{
					if (!ruleSetConfig) {
						var exception = exceptionFactory.create({
							"message": "请先打开目标组件容器！componentCode=" + componentCode + "windowCode=" + windowCode,
							"type": exceptionFactory.TYPES.Business
						});
						throw exception;
					}
					//创建游离DB
					fieldsMapping = ruleSetConfig.getInput(paramCode).getConfigs(); //inputs[paramCode].configs;
				}
				var freeDB = getFreeDB(fieldsMapping);
				var srcDB = null;
				switch (paramSource) {
					case "ruleSetInput":
						srcDB = routeContext.getInputParam(entityName);
						break;
					case "ruleSetVar":
						srcDB = routeContext.getVariable(entityName);
						break;
					case "windowInput":
						srcDB = windowParam.getInput({"code":entityName});
						break;
					default:
						srcDB = datasourceManager.lookup({
							"datasourceName": entityName
						});
						break;
				}
				
				if (srcDB) {
					datasourcePusher.copyBetweenEntities({
						"sourceEntity": srcDB,
						"destEntity": freeDB,
						"valuesMapping": paramFieldMapping,
						"dataFilterType": dataFilterType,
						"routeContext": routeContext
					});
				}
				
				param[paramCode] = freeDB;
			}
		}
		if (sourceType == "server-ruleSet") {
			return param;
		}
		//如果调用活动集时，设置了入参，则将此入参的值覆盖到活动集原始配置参数中。
		var mockParam = {};
		if (ruleSetConfig && ruleSetConfig.getInputs()) {
			var ruleSetcfg_inputs = ruleSetConfig.getInputs();
			for (var i = 0, l = ruleSetcfg_inputs.length; i < l; i++) {
				var input_Obj = ruleSetcfg_inputs[i];
				var input_value = input_Obj.geInitValue();
				var type = input_Obj.getType();
				//如果参数为实体类型，则转为游离DB
				if (type == "entity") {
					var fieldsMapping = input_Obj.getConfigs();;
					var freeDB = getFreeDB(fieldsMapping);
					input_value = freeDB;
				}
				mockParam[input_code] = input_value;
				for (var param_code in param) {
					if (input_code = param_code) {
						mockParam[input_code] = param[param_code];
					}
				}
			}
		}
		//执行SPI活动集时，当发现有configData信息时，需要以configData的入参来替换掉原装SPI入参
		if (invokeType == "spi") {
			var configData_inputs = appData.getRuleSetInputs({"componentCode":componentCode, "windowCode":windowCode, "metaCode":ruleSetCode});
			if (configData_inputs && configData_inputs.length > 0) {
				//用configData过滤:只过滤非实体类型。(目前只考虑简单类型的匹配，即非实体类型)
				if (configData_inputs && configData_inputs.length > 0) {
					for (var input_code in mockParam) {
						for (var j = 0; j < configData_inputs.length; j++) {
							var configDataObj = configData_inputs[j];
							var configDataObj_code = configDataObj.getCode();
							var configDataObj_initValue = configDataObj.geInitValue();
							if (input_code == configDataObj_code) {
								mockParam[input_code] = configDataObj_initValue;
							}
						}
					}
				}
			}
		}
		return mockParam;
	}

	var copyEntityFromMapping = function(srcEntity, destEntity, valuesMapping, dataFilterType) {
		var dataValues = [];
		//得到源实体所有记录
		var srcAllRecords = srcEntity.getAllRecords().toArray();
		//根据值映射信息将记录载入目标实体
		for (var i = 0; i < srcAllRecords.length; i++) {
			var curRecord = srcAllRecords[i];
			var dsState = curRecord.getState();
			var paramValueObj = {};
			var isExistValue = false;
			for (var j = 0; j < valuesMapping.length; j++) {
				var mapping = valuesMapping[j];
				var paramEntityField = mapping["paramEntityField"];
				var fieldValueType = mapping["fieldValueType"];
				var fieldValue = mapping["fieldValue"];
				if (dataFilterType == "modify" && dsState == "default") {
					continue;
				}
				if (curRecord != null) {
					isExistValue = true;
					//字段值类型为前台实体字段时
					if (fieldValueType == "field") {
						paramValueObj[paramEntityField] = curRecord.get(fieldValue);
					} else { //表达式类型
						paramValueObj[paramEntityField] = formulaUtil.evalExpression(fieldValue);
					}
				}
			}
			// 如果记录没有ID的情况下，补充UUID
			if (isExistValue) {
				if (typeof(paramValueObj.id) == "undefined" || null == paramValueObj.id) {
					paramValueObj.id = uuid.generate();
				}
				dataValues.push(paramValueObj);
			}
		}
		var valuesCfg = {
			metadata: {
				model: destEntity.getMetadata()
			},
			datas: {
				values: dataValues
			}
		};
		destEntity.loadData(valuesCfg, true, false, true);
		destEntity.resetState();
		return destEntity;
	};

	/**
	 * 处理invokeTarget参数：
	 * 1，调用本地或扩展点活动集
	 * 		1）componentCode取当前窗体所在构件的
	 *      2）如果活动集所在位置是window级别，且windowCode为空，则取当前窗体的windowCode
	 * 2，调用方式为API不做处理
	 */
	var processRuleLocation = function(invokeTarget) {
			var ruleLocation = invokeTarget.ruleLocation;
			var invokeType = invokeTarget.invokeType;
			if (invokeType == "local" || invokeType == "extensionPoint" || invokeType == "spi") {
				//取当前窗体所在构件的code赋值componentCode
				//如果窗体code为空，同样取当前窗体的windowCode
				if (ruleLocation == "window" && !invokeTarget.windowCode) {
					var scope = scopeManager.getWindowScope();
					invokeTarget.componentCode = scope.getComponentCode();
					invokeTarget.windowCode = scope.getWindowCode()
				}else{
					var scope = scopeManager.getScope();
					invokeTarget.componentCode = scope.getComponentCode();
				}
			}
		}
		/**
		 * 给控件赋值
		 */
	var setWidgetValue = function(destWidgetId, value) {
		var widgetCode;
		if (destWidgetId != null && destWidgetId.indexOf(".") != -1) {
			var splits = destWidgetId.split(".");
			var widgetCode = splits[0];
		} else {
			widgetCode = destWidgetId;
		}
		//2017-01-18 liangzc：判断是否多值控件
		var control_store_type = widgetContext.getStoreType(widgetCode);
		if(control_store_type!=undefined && control_store_type == "singleRecordMultiValue"){
			widgetProperty.set(widgetCode, "Value", value);
		}else{
			widgetDatasource.setSingleValue(widgetCode, value);
		}
	};


	//注册规则主入口方法(必须有)
	exports.main = main;

export{    main}