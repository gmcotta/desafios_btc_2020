import paho.mqtt.client as mqtt
import paho.mqtt.subscribe as subscribe
import json

msg_rows = []

with open('teste_js.json') as json_file:
  data = json.load(json_file)
  for row in data:
    msg_rows.append(row['row'])
  # for row in data['row']:
  #   msg_rows.append(row)

print(len(msg_rows))

while(len(msg_rows) <= 17016):
  msg2 = subscribe.simple(
      "tnt", 
      hostname="tnt-iot.maratona.dev", 
      port=30573, 
      auth={"username": "maratoners", "password": "ndsjknvkdnvjsbvj"}
    )
  string_msg = str(msg2.payload, 'utf-8')
  json_msg = json.loads(string_msg)
  row = json_msg["row"]
  if row not in msg_rows:
    # print(json_msg)
    print(json_msg["row"])
    msg_rows.append(json_msg["row"])
    with open("teste.json", "a+") as writer:
      json.dump(json_msg, writer, ensure_ascii=False)
      writer.write(", \n")
  else:
    print(f"#{json_msg['row']} já está na lista")


# while(True):
#   msg = subscribe.simple(
#     "tnt", 
#     hostname="tnt-iot.maratona.dev", 
#     port=30573, 
#     auth={"username": "maratoners", "password": "ndsjknvkdnvjsbvj"}
#   )
#   msg_array.append(str(msg.payload, 'utf-8'))
#   print(str(msg.payload, 'utf-8'))
