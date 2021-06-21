/**
 *
 *
 */

		var jsonUtil,
			manager,
			expressionContext,
			engine,
			missUpdate,
			sandbox; 
		//初始化vjs模块，如果规则逻辑需要引用相关vjs服务，则初始化相关vjs模块；如果不需要初始化逻辑可以为空
		exports.initModule = function(sBox){
			//sBox：前台vjs的沙箱（容器/上下文），可以用它根据vjs名称，获取到相应vjs服务
			sandbox = sBox;
			jsonUtil = sandbox.getService("vjs.framework.extension.util.JsonUtil");
			manager = sandbox.getService("vjs.framework.extension.platform.services.model.manager.datasource.DatasourceManager");
			expressionContext = sandbox.getService("vjs.framework.extension.platform.engine.expression.ExpressionContext");
			engine = sandbox.getService("vjs.framework.extension.platform.engine.expression.ExpressionEngine");
		}
		
		//规则主入口(必须有)
		var main = function (ruleContext) {
			// 获取规则链路由上下文,终止执行后续规则
			var routeContext = ruleContext.getRouteContext();
	//		// 获取规则链路由上下文的配置参数值
			var ruleCfgValue = ruleContext.getRuleCfg();
	//		// 获取开发系统配置的参数
			var inParams = ruleCfgValue["inParams"];
			var inParamObj = jsonUtil.json2obj(inParams);
			var varCode = inParamObj.LoopVar;
			var entity = inParamObj.LoopEntity;
			var type = inParamObj.LoopEntityType;
			var fields = inParamObj.Fields;
			
			var datasource = routeContext.getForEachVarDataSource(varCode);
//			if(type == "window"){
//				datasource = manager.lookup({
//					"datasourceName": entity
//				});
//			}else{
//				var context = new expressionContext();
//				context.setRouteContext(routeContext);
//				/*方法实体*/
//				datasource = engine.execute({
//					"expression": getEntityCode(entity, type),
//					"context": context
//				});
//			}
			if(datasource){
//				//create test data
//				fields = jsonUtil.json2obj(fields);
//				routeContext.setForEachVar({
//					'code':varCode,
//					'value':datasource.getAllRecords().toArray()[0],
//					'datasource':datasource
//				});
//				//end
				var record = routeContext.getForEachVarValue(varCode);
				if(fields && fields.length > 0){
					var context = new expressionContext();
					context.setRouteContext(routeContext);
					for(var i = 0,l=fields.length;i<l;i++){
						var fieldInfo = fields[i];
						var value = engine.execute({
							"expression": fieldInfo.Source,
							"context": context
						});
						record.set(fieldInfo.LoopVarField,value)
					}
					datasource.updateRecords({'records':[record]});
				}
			}else{
				throw Error("实体["+entity+"]不存在");
			}
		};
		var getEntityCode = function(entity,type){
			switch(type){
				case "window":
					return entity;
					break;
				case "ruleSetOutput":
					return "BR_OUT_PARENT." + entity;
					break;
				case "ruleSetVar":
					return "BR_VAR_PARENT." + entity;
					break;
				case "ruleSetInput":
					return "BR_IN_PARENT." + entity;
					break;
			}
		}
		//注册规则主入口方法(必须有)
		exports.main = main;
	
export{    main}