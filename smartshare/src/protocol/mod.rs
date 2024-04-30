use futures::{Sink, Stream};
use tokio::io::{AsyncRead, AsyncWrite};
use tokio_serde::formats::SymmetricalJson;
use tokio_util::codec::{FramedRead, FramedWrite};

use self::codec::LineSeparatedCodec;
use self::msg::Message;

pub mod codec;
pub mod msg;

pub fn message_stream<R>(read: R) -> impl Stream<Item = anyhow::Result<Message>>
where
    R: AsyncRead,
{
    let framed = FramedRead::new(read, LineSeparatedCodec::default());
    tokio_serde::SymmetricallyFramed::<_, Message, _>::new(
        framed,
        SymmetricalJson::<Message>::default(),
    )
}

pub fn message_sink<R>(write: R) -> impl Sink<Message, Error = anyhow::Error>
where
    R: AsyncWrite,
{
    let framed = FramedWrite::new(write, LineSeparatedCodec::default());
    tokio_serde::SymmetricallyFramed::<_, Message, _>::new(
        framed,
        SymmetricalJson::<Message>::default(),
    )
}