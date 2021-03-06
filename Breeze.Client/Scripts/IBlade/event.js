﻿define(["coreFns", "assertParam"], function (core, m_assertParam) {
    
    var assertParam = m_assertParam.assertParam;
    
    "use strict";

    /**
    @module core
    **/

    var __eventNameMap = { };

    /**
    Class to support basic event publication and subscription semantics.
    @class Event
    **/

    /**
    Constructor for an Event
    @example
        salaryEvent = new Event("salaryEvent", person);
    @method <ctor> Event
    @param name {String}
    @param publisher {Object} The object that will be doing the publication. i.e. the object to which this event is attached. 
    @param [defaultErrorCallback] {Function} If omitted then subscriber notification failures will be ignored.

    errorCallback([e])
    @param [defaultErrorCallback.e] {Error} Any error encountered during subscription execution.
    **/
    var Event = function (name, publisher, defaultErrorCallback, defaultFn) {
        assertParam(name, "eventName").isNonEmptyString();
        assertParam(publisher, "publisher").isObject();
        var that;
        if (defaultFn) {
            that = defaultFn;
        } else {
            that = this;
        }
        that.name = name;
        // register the name
        __eventNameMap[name] = true;
        that.publisher = publisher;
        that._nextUnsubKey = 1;
        if (defaultErrorCallback) {
            that._defaultErrorCallback = defaultErrorCallback;
        }
        if (defaultFn) {
            core.extend(defaultFn, Event.prototype);
            return defaultFn;
        }
    };

    /**
    Publish data for this event.
    @example
        // Assume 'salaryEvent' is previously constructed Event
        salaryEvent.publish( { eventType: "payRaise", amount: 100 });
    This event can also be published asychonously
    @example
        salaryEvent.publish( { eventType: "payRaise", amount: 100 }, true);
    And we can add a handler in case the subscriber 'mishandles' the event.
    @example
        salaryEvent.publish( { eventType: "payRaise", amount: 100 }, true, function(error) {
            // do something with the 'error' object
        });
    @method publish
    @param data {Object} Data to publish
    @param [publishAsync=false] Whether to publish asynchonously or not.
    @param [errorCallback] {Function} Will be called for any errors that occur during publication. If omitted, 
    errors will be eaten.

    errorCallback([e])
    @param [errorCallback.e] {Error} Any error encountered during publication execution.
    @return {Boolean} false if event is disabled; true otherwise.
    **/
    Event.prototype.publish = function(data, publishAsync, errorCallback) {

        function publishCore() {
            // subscribers from outer scope.
            subscribers.forEach(function(s) {
                try {
                    s.callback(data);
                } catch(e) {
                    e.context = "unable to publish on topic: " + this.name;
                    if (errorCallback) {
                        errorCallback(e);
                    } else if (this._defaultErrorCallback) {
                        this._defaultErrorCallback(e);
                    } else {
                        fallbackErrorHandler(e);
                    }
                }
            });
        }
        
        if (!Event._isEnabled(this.name, this.publisher)) return false;
        var subscribers = this._subscribers;
        if (!subscribers) return true;
        
        if (publishAsync === true) {
            setTimeout(publishCore, 0);
        } else {
            publishCore();
        }
        return true;
    };

    /**
   Publish data for this event asynchronously.
   @example
       // Assume 'salaryEvent' is previously constructed Event
       salaryEvent.publishAsync( { eventType: "payRaise", amount: 100 });
   And we can add a handler in case the subscriber 'mishandles' the event.
   @example
       salaryEvent.publishAsync( { eventType: "payRaise", amount: 100 }, function(error) {
           // do something with the 'error' object
       });
   @method publishAsync
   @param data {Object} Data to publish
   @param [errorCallback] {Function} Will be called for any errors that occur during publication. If omitted, 
   errors will be eaten.

   errorCallback([e])
   @param [errorCallback.e] {Error} Any error encountered during publication execution.
   **/
    Event.prototype.publishAsync = function(data, errorCallback) {
        this.publish(data, true, errorCallback);
    };

    /**
    Subscribe to this event.
    @example
        // Assume 'salaryEvent' is previously constructed Event
        salaryEvent.subscribe(function (eventArgs) {
            if (eventArgs.eventType === "payRaise") {
               // do something
            }
        });
    There are several built in Breeze events, such as EntityAspect.propertyChanged, EntityAspect.validationErrorsChanged as well.
    @example
         // Assume order is a preexisting 'order' entity
         order.entityAspect.propertyChanged.subscribe(function (pcEvent) {
             if ( pcEvent.propertyName === "OrderDate") {
                 // do something
             }
         });
    @method subscribe
    @param [callback] {Function} Will be called whenever 'data' is published for this event. 

        callback([data])
        @param [callback.data] {Object} Whatever 'data' was published.  This should be documented on the specific event.
    @return {Number} This is a key for 'unsubscription'.  It can be passed to the 'unsubscribe' method.
    **/
    Event.prototype.subscribe = function(callback) {
        if (!this._subscribers) {
            this._subscribers = [];
        }

        var unsubKey = this._nextUnsubKey;
        this._subscribers.push({ unsubKey: unsubKey, callback: callback });
        ++this._nextUnsubKey;
        return unsubKey;
    };

    /**
    Unsubscribe from this event. 
    @example
        // Assume order is a preexisting 'order' entity
        var token = order.entityAspect.propertyChanged.subscribe(function (pcEvent) {
                // do something
        });
        // sometime later
        order.entityAspect.propertyChanged.unsubscribe(token);
    @method unsubscribe
    @param unsubKey {Number} The value returned from the 'subscribe' method may be used to unsubscribe here.
    @return {Boolean} Whether unsubscription occured. This will return false if already unsubscribed or if the key simply
    cannot be found.
    **/
    Event.prototype.unsubscribe = function(unsubKey) {
        if (!this._subscribers) return false;
        var subs = this._subscribers;
        var ix = core.arrayIndexOf(subs, function(s) {
            return s.unsubKey === unsubKey;
        });
        if (ix !== -1) {
            subs.splice(ix, 1);
            if (subs.length === 0) {
                delete this._subscribers;
            }
            return true;
        } else {
            return false;
        }
    };
    
    // event bubbling - document later.
    Event.bubbleEvent = function (target, getParentFn) {
        target._getEventParent = getParentFn;
    };

    /**
    Enables or disables the named event for an object and all of its children. 
    @example
        Event.enable(“propertyChanged”, myEntityManager, false) 
    will disable all EntityAspect.propertyChanged events within a EntityManager.
    @example
        Event.enable(“propertyChanged”, myEntityManager, true) 
    will enable all EntityAspect.propertyChanged events within a EntityManager.
    @example
        Event.enable(“propertyChanged”, myEntity.entityAspect, false) 
    will disable EntityAspect.propertyChanged events for a specific entity.
    @example
        Event.enable(“propertyChanged”, myEntity.entityAspect, null) 
    will removes any enabling / disabling at the entity aspect level so now any 'Event.enable' calls at the EntityManager level, 
    made either previously or in the future, will control notification.
    @example
        Event.enable(“validationErrorsChanged”, myEntityManager, function(em) {     
           return em.customTag === “blue”;
        })                 
    will either enable or disable myEntityManager based on the current value of a ‘customTag’ property on myEntityManager. 
    Note that this is dynamic, changing the customTag value will cause events to be enabled or disabled immediately.
    @method enable
    @static
    @param eventName {String} The name of the event. 
    @param target {Object} The object at which enabling or disabling will occur.  All event notifications that occur to this object or 
    children of this object will be enabled or disabled. 
    @param isEnabled {Boolean|null|Function} A boolean, a null or a function that returns either a boolean or a null. 
    **/
    Event.enable = function (eventName, obj, isEnabled) {
        assertParam(eventName, "eventName").isNonEmptyString();
        assertParam(obj, "obj").isObject();
        assertParam(isEnabled, "isEnabled").isBoolean().isOptional().or().isFunction();
        eventName = getFullEventName(eventName);
        if (!obj._$eventMap) {
            obj._$eventMap = {};
        }
        obj._$eventMap[eventName] = isEnabled;
    };

    Event._enableFast = function(event, obj, isEnabled) {
        if (!obj._$eventMap) {
            obj._$eventMap = {};
        }
        obj._$eventMap[event.name] = isEnabled;
    };

    /**
    Returns whether for a specific event and a specific object and its children, notification is enabled or disabled or not set. 
    @example
        Event.isEnabled(“propertyChanged”, myEntityManager) 
    
    @method isEnabled
    @static
    @param eventName {String} The name of the event. 
    @param target {Object} The object for which we want to know if notifications are enabled. 
    @return {Boolean|null} A null is returned if this value has not been set.
    **/
    Event.isEnabled = function (eventName, obj) {
        assertParam(eventName, "eventName").isNonEmptyString();
        assertParam(obj, "obj").isObject();
        if (!obj._getEventParent) {
            throw new Error("This object does not support event enabling/disabling");
        }
        return Event._isEnabled(obj, getFullEventName(eventName));
    };

    Event._isEnabled = function(eventName, obj) {
        var isEnabled = null;
        var eventMap = obj._$eventMap;
        if (eventMap) {
            isEnabled = eventMap[eventName];
        }
        if (isEnabled != null) {
            if (typeof isEnabled === 'function') {
                return isEnabled(obj);
            } else {
                return !!isEnabled;
            }
        } else {
            var parent = obj._getEventParent && obj._getEventParent();
            if (parent) {
                return Event._isEnabled(eventName, parent);
            } else {
                // default if not explicitly disabled.
                return true;
            }
        }
    };

    function getFullEventName(eventName) {
        if (__eventNameMap[eventName]) return eventName;
        // find the closest event name that matches
        var fullEventName = core.arrayFirst(Object.keys(__eventNameMap), function (name) {
            return name.indexOf(eventName) === 0;
        });
        if (!fullEventName) {
            throw new Error("Unable to find any registered event that matches: " + eventName);
        }
        return fullEventName;
    }
    
    function fallbackErrorHandler(e) {
        // TODO: maybe log this 
        // for now do nothing;
    }



    return Event;
});
