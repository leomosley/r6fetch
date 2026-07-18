use std::cell::RefCell;
use std::rc::Rc;

use futures::future::{Either, FutureExt, LocalBoxFuture, Shared, select};
use r6_client::{
    ConfigResponse, Platform, PlayerProfile, R6Error, normalise_profile, parse_config_response,
    parse_profile_response,
};
use serde_json::Value;
use std::time::Duration;
use worker::{AbortController, Date, Delay, Fetch, Headers, Method, Request, RequestInit};

const API_BASE: &str = "https://r6.stats.cc/v2";
const CONFIG_TTL_MS: f64 = 300_000.0;
type ConfigFuture = Shared<LocalBoxFuture<'static, Result<Rc<ConfigResponse>, Rc<R6Error>>>>;

#[derive(Default)]
struct ClientState {
    api_key: String,
    config: Option<Rc<ConfigResponse>>,
    config_fetched_at: f64,
    config_request: Option<ConfigFuture>,
}

thread_local! { static STATE: RefCell<ClientState> = RefCell::new(ClientState::default()); }

fn headers(api_key: &str) -> Result<Headers, R6Error> {
    let headers = Headers::new();
    headers
        .set("X-Api-Key", api_key)
        .map_err(|error| R6Error::Api(error.to_string()))?;
    headers
        .set("User-Agent", "r6fetch.cc")
        .map_err(|error| R6Error::Api(error.to_string()))?;
    Ok(headers)
}

fn request(url: &str, api_key: &str) -> Result<Request, R6Error> {
    let mut init = RequestInit::new();
    init.with_method(Method::Get)
        .with_headers(headers(api_key)?);
    Request::new_with_init(url, &init).map_err(|error| R6Error::Api(error.to_string()))
}

fn status_text(status: u16) -> &'static str {
    match status {
        400 => "Bad Request",
        401 => "Unauthorized",
        403 => "Forbidden",
        404 => "Not Found",
        408 => "Request Timeout",
        429 => "Too Many Requests",
        500 => "Internal Server Error",
        502 => "Bad Gateway",
        503 => "Service Unavailable",
        504 => "Gateway Timeout",
        _ => "",
    }
}

async fn timed_fetch(request: Request) -> Result<worker::Response, worker::Error> {
    let controller = AbortController::default();
    let signal = controller.signal();
    let fetch =
        async move { Fetch::Request(request).send_with_signal(&signal).await }.boxed_local();
    let timeout = Delay::from(Duration::from_secs(10)).boxed_local();
    match select(fetch, timeout).await {
        Either::Left((result, _)) => result,
        Either::Right(((), _)) => {
            controller.abort();
            Err(worker::Error::RustError("request timed out".into()))
        }
    }
}

fn config(api_key: String) -> ConfigFuture {
    let now = Date::now().as_millis() as f64;
    STATE.with_borrow_mut(|state| {
        if state.api_key != api_key {
            state.api_key = api_key.clone();
            state.config = None;
            state.config_fetched_at = 0.0;
            state.config_request = None;
        }
    });
    if let Some(value) = STATE.with_borrow(|state| {
        (state.api_key == api_key && now - state.config_fetched_at < CONFIG_TTL_MS)
            .then(|| state.config.clone())
            .flatten()
    }) {
        return futures::future::ready(Ok(value)).boxed_local().shared();
    }
    if let Some(in_flight) = STATE.with_borrow(|state| state.config_request.clone()) {
        return in_flight;
    }
    let future = async move {
        let result = async {
            let req = request(&format!("{API_BASE}/config"), &api_key)?;
            let mut response = timed_fetch(req).await.map_err(|error| {
                R6Error::Api(format!("Failed to fetch or decode API config: {error}"))
            })?;
            if !(200..300).contains(&response.status_code()) {
                let status = response.status_code();
                return Err(R6Error::Api(
                    format!("Failed to fetch config: {status} {}", status_text(status))
                        .trim_end()
                        .into(),
                ));
            }
            let value: Value = response.json().await.map_err(|error| {
                R6Error::Api(format!("Failed to fetch or decode API config: {error}"))
            })?;
            parse_config_response(&value).map(Rc::new)
        }
        .await;
        STATE.with_borrow_mut(|state| {
            if state.api_key != api_key {
                return;
            }
            state.config_request = None;
            if let Ok(value) = &result {
                state.config = Some(value.clone());
                state.config_fetched_at = Date::now().as_millis() as f64;
            }
        });
        result.map_err(Rc::new)
    }
    .boxed_local()
    .shared();
    STATE.with_borrow_mut(|state| state.config_request = Some(future.clone()));
    future
}

fn encode_username(value: &str) -> Result<String, R6Error> {
    worker::js_sys::encode_uri_component(value)
        .as_string()
        .ok_or_else(|| R6Error::InvalidInput("Username could not be encoded".into()))
}

pub async fn profile(
    platform: Platform,
    username: &str,
    api_key: &str,
) -> Result<PlayerProfile, R6Error> {
    let config_future = config(api_key.into());
    worker::wasm_bindgen_futures::spawn_local({
        let future = config_future.clone();
        async move {
            let _ = future.await;
        }
    });
    let encoded = encode_username(username)?;
    let req = request(
        &format!("{API_BASE}/profiles/{}/{encoded}", platform.api_name()),
        api_key,
    )?;
    let mut response = timed_fetch(req).await.map_err(|error| {
        R6Error::Api(format!("Failed to fetch profile for {username}: {error}"))
    })?;
    if response.status_code() == 404 {
        return Err(R6Error::PlayerNotFound {
            username: username.into(),
            platform: platform.as_str().into(),
        });
    }
    if !(200..300).contains(&response.status_code()) {
        let status = response.status_code();
        return Err(R6Error::Api(
            format!("Failed to fetch profile: {status} {}", status_text(status))
                .trim_end()
                .into(),
        ));
    }
    let config = config_future.await.map_err(|error| (*error).clone())?;
    let value: Value = response
        .json()
        .await
        .map_err(|error| R6Error::Decode(format!("Failed to decode profile response: {error}")))?;
    let parsed = parse_profile_response(&value)?;
    normalise_profile(
        platform,
        &parsed,
        &config.current_season,
        &config.ranked_bomb_mode,
    )
}
